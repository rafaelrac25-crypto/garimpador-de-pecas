/**
 * Scraper Mercado Livre via Playwright. Roda no GitHub Actions
 * (cron 2h + manual dispatch). Popula tabela ml_offers_cache no Neon.
 *
 * Por que Playwright em vez de scraping HTTP simples:
 *   ML bloqueia IPs de datacenter (Vercel/CF Worker = "suspicious-traffic").
 *   GitHub Actions tem IP de runner Azure, mas com Chromium real + headers
 *   de browser, passa o anti-bot na maioria dos casos.
 *
 * Variáveis de ambiente (setadas pelo workflow):
 *   DATABASE_URL — Neon Postgres (mesma do app)
 *
 * Uso local: DATABASE_URL=... node scripts/scrape-ml.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const { neon } = require('@neondatabase/serverless');

/* Termos pré-definidos pra C10/C14. Editável — adicionar/remover aqui.
   Cada termo gera 1 chamada ML; resultado = ~30-50 anúncios por termo. */
const TERMOS = [
  { q: 'carburador c10',           modelo: 'C10' },
  { q: 'kit motor c10',            modelo: 'C10' },
  { q: 'para choque c10',          modelo: 'C10' },
  { q: 'cacamba c10',              modelo: 'C10' },
  { q: 'banco c10',                modelo: 'C10' },
  { q: 'farol c10',                modelo: 'C10' },
  { q: 'retrovisor c10',           modelo: 'C10' },
  { q: 'volante c10',              modelo: 'C10' },
  { q: 'emblema c10',              modelo: 'C10' },
  { q: 'friso c10',                modelo: 'C10' },
  { q: 'carburador c14',           modelo: 'C14' },
  { q: 'kit motor c14',            modelo: 'C14' },
  { q: 'pisca c10 c14',            modelo: 'C10' },
  { q: 'tanque combustivel c10',   modelo: 'C10' },
  { q: 'caixa cambio c10',         modelo: 'C10' },
];

const PER_TERMO_LIMIT = 30;
const NAV_TIMEOUT = 25000;

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeTerm(page, termo) {
  const url = `https://lista.mercadolivre.com.br/${slugify(termo.q)}`;
  console.log(`[ml] ${termo.q} → ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForSelector('li.ui-search-layout__item, .poly-card, .ui-search-result', {
      timeout: 8000,
    }).catch(() => null);
  } catch (err) {
    console.warn(`[ml] navegação falhou em "${termo.q}":`, err.message);
    return [];
  }

  const items = await page.evaluate((max) => {
    const cards = Array.from(document.querySelectorAll(
      'li.ui-search-layout__item, .poly-card, .ui-search-result'
    )).slice(0, max);

    return cards.map((el) => {
      const link = el.querySelector('a.poly-component__title, a.ui-search-link, h2 a');
      const url = link?.href
        || el.querySelector('a[href*="/MLB-"]')?.href
        || el.querySelector('a[href*="MLB"]')?.href;
      if (!url) return null;

      const title = (link?.textContent
        || el.querySelector('.poly-component__title, .ui-search-item__title')?.textContent
        || '').trim();
      if (!title) return null;

      const priceText = el.querySelector('.andes-money-amount__fraction')?.textContent?.trim();
      const centsText = el.querySelector('.andes-money-amount__cents')?.textContent?.trim();
      let price = null;
      if (priceText) {
        const integer = parseInt(priceText.replace(/\D/g, ''), 10);
        const cents = parseInt(centsText || '0', 10);
        if (Number.isFinite(integer)) price = integer + (Number.isFinite(cents) ? cents / 100 : 0);
      }

      const img = el.querySelector('img.poly-component__picture, img.ui-search-result-image__element, img');
      const thumb = img?.getAttribute('src') || img?.getAttribute('data-src');
      const idMatch = url.match(/MLB-?(\d+)/);
      const externalId = idMatch ? `MLB${idMatch[1]}` : null;
      if (!externalId) return null;

      const shippingText = (el.querySelector('.poly-component__shipping, [class*="shipping"]')?.textContent || '').toLowerCase();
      const freeShipping = shippingText.includes('frete grátis') || shippingText.includes('grátis');

      return {
        externalId,
        title,
        price,
        url,
        thumbUrl: thumb && !thumb.startsWith('data:') ? thumb : null,
        freeShipping,
      };
    }).filter(Boolean);
  }, PER_TERMO_LIMIT);

  console.log(`[ml] ${termo.q} → ${items.length} anúncios`);
  return items.map((it) => ({ ...it, termo: termo.q, modelo: termo.modelo }));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não setada. Abortando.');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  /* Warmup: visita home do ML primeiro pra setar cookies de sessão.
     Sem isso, ML detecta a 2ª request como "sem fingerprint" e bloqueia. */
  try {
    await page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    console.log('[ml] warmup ok');
  } catch (e) {
    console.warn('[ml] warmup falhou:', e.message);
  }

  let totalCount = 0;
  let termosOk = 0;
  let lastError = null;

  try {
    for (const termo of TERMOS) {
      try {
        const items = await scrapeTerm(page, termo);
        if (items.length === 0) {
          lastError = `sem anúncios em "${termo.q}"`;
          continue;
        }
        termosOk++;

        /* Upsert via parametrização — Neon serverless aceita batches.
           ON CONFLICT atualiza preço/título caso anúncio mude. */
        for (const it of items) {
          await sql`
            INSERT INTO ml_offers_cache (
              external_id, termo, modelo, title, price, url, thumb_url, free_shipping, scraped_at
            ) VALUES (
              ${it.externalId}, ${it.termo}, ${it.modelo}, ${it.title},
              ${it.price}, ${it.url}, ${it.thumbUrl}, ${it.freeShipping ? 1 : 0}, NOW()
            )
            ON CONFLICT (external_id) DO UPDATE SET
              title = EXCLUDED.title,
              price = EXCLUDED.price,
              thumb_url = EXCLUDED.thumb_url,
              free_shipping = EXCLUDED.free_shipping,
              scraped_at = NOW()
          `;
          totalCount++;
        }

        /* Throttle: 8s entre termos + jitter aleatório. ML detecta padrão regular. */
        await page.waitForTimeout(8000 + Math.floor(Math.random() * 3000));
      } catch (err) {
        lastError = `${termo.q}: ${err.message}`;
        console.warn(`[ml] erro em "${termo.q}":`, err.message);
      }
    }

    /* Limpa registros velhos (>14 dias) — anúncio sumiu da listagem. */
    await sql`DELETE FROM ml_offers_cache WHERE scraped_at < NOW() - INTERVAL '14 days'`;

    /* Atualiza status */
    await sql`
      UPDATE ml_scrape_status SET
        last_run_at = NOW(),
        last_run_count = ${totalCount},
        last_run_status = ${termosOk > 0 ? 'ok' : 'failed'},
        last_run_termos = ${termosOk},
        last_error = ${lastError}
      WHERE id = 1
    `;

    console.log(`[ml] FIM. Termos OK: ${termosOk}/${TERMOS.length}. Anúncios: ${totalCount}.`);
  } finally {
    await browser.close();
  }

  if (termosOk === 0) {
    console.error('[ml] nenhum termo retornou — anti-bot pode estar ativo');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[ml] erro fatal:', err);
  process.exit(1);
});
