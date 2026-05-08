/**
 * Scraper Mercado Livre via Playwright. Roda no GitHub Actions
 * (cron horário + manual dispatch). Popula tabela ml_offers_cache no Neon.
 *
 * Estratégia "1 termo por run":
 *   ML detecta padrão de buscas seguidas no mesmo run/IP. Solução:
 *   cada execução do workflow processa apenas 1 termo, pega novo IP do
 *   pool GitHub Actions, browser fresh. 24 runs/dia = 24 termos cobertos.
 *   Cron a cada 1h: índice = (epoch_hours) % len(TERMOS+aprendidos).
 *
 * Modos:
 *   - Sem args: pega 1 termo pela rotação automática
 *   - --termo "alternador c10" --modelo C10: termo específico (on-demand)
 *
 * Variáveis de ambiente:
 *   DATABASE_URL — Neon Postgres (mesma do app)
 *   ML_USER      — email/usuário ML (conta descartável criada pra scraping)
 *   ML_PASSWORD  — senha
 *   ML_TERMO     — alternativa a --termo (workflow_dispatch passa via env)
 *   ML_MODELO    — alternativa a --modelo
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const { neon } = require('@neondatabase/serverless');

/* Termos pré-definidos pra C10/C14. Tabela ml_terms_learned é mesclada em runtime. */
const TERMOS_BASE = [
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

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { termo: process.env.ML_TERMO || null, modelo: process.env.ML_MODELO || null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--termo' && args[i + 1]) out.termo = args[++i];
    else if (args[i] === '--modelo' && args[i + 1]) out.modelo = args[++i];
  }
  return out;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* Carrega/salva sessão Playwright autenticada do Neon. Evita re-login a cada
   run. Storage state inclui cookies + localStorage; tamanho típico ~30-100KB. */
async function loadSession(sql) {
  try {
    const r = await sql`SELECT storage_state, saved_at FROM ml_session WHERE id = 1`;
    const row = r?.[0];
    if (!row?.storage_state) return null;
    /* Sessão velha (>10 dias) — força re-login pra evitar cookies expirados */
    const ageDays = (Date.now() - new Date(row.saved_at).getTime()) / 86400000;
    if (ageDays > 10) {
      console.log(`[ml] sessão antiga (${ageDays.toFixed(1)}d) — re-login`);
      return null;
    }
    return JSON.parse(row.storage_state);
  } catch (e) {
    console.warn('[ml] loadSession falhou:', e.message);
    return null;
  }
}

async function saveSession(sql, state) {
  try {
    const json = JSON.stringify(state);
    await sql`UPDATE ml_session SET storage_state = ${json}, saved_at = NOW() WHERE id = 1`;
    console.log(`[ml] session salva (${json.length} bytes)`);
  } catch (e) {
    console.warn('[ml] saveSession falhou:', e.message);
  }
}

/* Tenta login no ML. Retorna true se logado com sucesso. ML usa fluxo
   2-passos: usuário → senha. Conta nova precisa ter 2FA desabilitado. */
async function loginIfNeeded(page) {
  if (!process.env.ML_USER || !process.env.ML_PASSWORD) {
    console.log('[ml] sem ML_USER/ML_PASSWORD — modo anônimo (provavel falha)');
    return false;
  }

  try {
    await page.goto('https://www.mercadolivre.com.br/jms/mlb/lgz/login', {
      waitUntil: 'domcontentloaded', timeout: 25000,
    });
    /* Já logado? URL final fora de /lgz/ indica redirect pós-login. */
    if (!page.url().includes('/lgz/')) {
      console.log('[ml] já logado (redirect inicial)');
      return true;
    }

    /* Passo 1: usuário */
    await page.waitForSelector('input[name="user_id"], input[name="login"]', { timeout: 10000 });
    const userInput = (await page.$('input[name="user_id"]')) || (await page.$('input[name="login"]'));
    await userInput.fill(process.env.ML_USER);
    await page.waitForTimeout(800 + Math.random() * 600);
    await page.click('button[type="submit"], button:has-text("Continuar")');

    /* Passo 2: senha */
    await page.waitForSelector('input[name="password"]', { timeout: 12000 });
    await page.fill('input[name="password"]', process.env.ML_PASSWORD);
    await page.waitForTimeout(800 + Math.random() * 600);
    await page.click('button[type="submit"], button:has-text("Entrar")');

    /* Aguarda redirect pós-login */
    await page.waitForURL((url) => !url.toString().includes('/lgz/'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    /* Verifica sucesso: title sem "Login" e URL não contém /lgz/ */
    const finalUrl = page.url();
    const finalTitle = await page.title().catch(() => '');
    const success = !finalUrl.includes('/lgz/') && !/login|entrar/i.test(finalTitle);
    console.log(`[ml] login ${success ? 'ok' : 'FAIL'} url=${finalUrl} title="${finalTitle}"`);
    if (!success) {
      /* Captura tela do erro pra debug */
      try { await page.screenshot({ path: 'ml-login-fail.png' }); } catch {}
      const html = await page.content();
      require('fs').writeFileSync('ml-login-fail.html', html);
    }
    return success;
  } catch (e) {
    console.warn('[ml] login falhou:', e.message);
    return false;
  }
}

async function pickRotationTermo(sql) {
  /* Busca termos aprendidos do uso real (tabela ml_terms_learned).
     Mescla com base; rotação por hora UTC pra cobertura uniforme. */
  let learned = [];
  try {
    const r = await sql`SELECT q, modelo FROM ml_terms_learned WHERE active = 1 ORDER BY hits DESC LIMIT 50`;
    learned = r || [];
  } catch { /* tabela ainda não existe — primeira execução */ }

  const pool = [...TERMOS_BASE, ...learned.map(r => ({ q: r.q, modelo: r.modelo }))];
  const idx = Math.floor(Date.now() / 3600000) % pool.length;  /* hora UTC */
  return pool[idx];
}

async function warmup(page) {
  try {
    const resp = await page.goto('https://www.mercadolivre.com.br/', {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    const finalUrl = page.url();
    const finalTitle = await page.title().catch(() => '?');
    console.log(`[ml] warmup status=${resp?.status()} url=${finalUrl} title="${finalTitle}"`);
    /* Detecta redirect pra versão global: se url não tem .com.br, ML
       achou que somos não-BR. Cookies BR no context devem ter prevenido. */
    if (!finalUrl.includes('.com.br')) {
      console.warn('[ml] WARMUP redirecionou pra versão global — IP não-BR');
    }
    await page.waitForTimeout(2500 + Math.floor(Math.random() * 1500));
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    return true;
  } catch (e) {
    console.warn('[ml] warmup falhou:', e.message);
    return false;
  }
}

async function scrapeTerm(page, termo) {
  const url = `https://lista.mercadolivre.com.br/${slugify(termo.q)}`;
  console.log(`[ml] ${termo.q} → ${url}`);

  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    console.log(`[ml] HTTP status: ${response?.status()}`);
    await page.waitForSelector('li.ui-search-layout__item, .poly-card, .ui-search-result', {
      timeout: 12000,
    }).catch(() => null);
    /* Pequeno scroll pra forçar lazy-load das imagens */
    await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'auto' })).catch(() => {});
    await page.waitForTimeout(1500);
  } catch (err) {
    console.warn(`[ml] navegação falhou em "${termo.q}":`, err.message);
    return [];
  }

  /* Diagnóstico: dump título e primeiros 300 chars do body pra logs */
  try {
    const diag = await page.evaluate(() => ({
      title: document.title,
      bodyStart: document.body?.innerText?.slice(0, 300) || '',
      hasCards: !!document.querySelector('li.ui-search-layout__item, .poly-card, .ui-search-result'),
      bodyLen: document.body?.innerHTML?.length || 0,
    }));
    console.log(`[ml] DIAG title="${diag.title}" hasCards=${diag.hasCards} bodyLen=${diag.bodyLen}`);
    console.log(`[ml] DIAG bodyStart: ${diag.bodyStart.replace(/\s+/g, ' ').slice(0, 200)}`);
    /* Se não tem cards, salva HTML pra debug (artifact no workflow) */
    if (!diag.hasCards) {
      const fs = require('fs');
      const html = await page.content();
      fs.writeFileSync(`ml-block-${slugify(termo.q)}.html`, html);
      try { await page.screenshot({ path: `ml-block-${slugify(termo.q)}.png`, fullPage: false }); } catch {}
      console.log(`[ml] salvou ml-block-${slugify(termo.q)}.{html,png} pra debug`);
    }
  } catch (e) {
    console.warn('[ml] diag falhou:', e.message);
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

  /* Decide o termo desta execução */
  const args = parseArgs();
  let termo;
  if (args.termo) {
    termo = { q: args.termo, modelo: args.modelo || null };
    console.log(`[ml] modo on-demand: "${termo.q}"`);
  } else {
    termo = await pickRotationTermo(sql);
    console.log(`[ml] modo rotação: "${termo.q}"`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  /* Rotaciona viewport e UA pra reduzir fingerprint estável */
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  ];
  const ua = uas[Math.floor(Math.random() * uas.length)];

  /* Carrega sessão autenticada anterior (se existir e for recente) */
  const savedState = await loadSession(sql);
  if (savedState) console.log('[ml] reusando session salva');

  const context = await browser.newContext({
    userAgent: ua,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 720 + Math.floor(Math.random() * 100) },
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5',
    },
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
    storageState: savedState || undefined,
  });

  /* Cookies BR só se não tem session (com session, não sobrescreve). */
  if (!savedState) {
    await context.addCookies([
      { name: '_d2id', value: 'br', domain: '.mercadolivre.com.br', path: '/' },
      { name: 'c_ui-navigation', value: '1', domain: '.mercadolivre.com.br', path: '/' },
    ]);
  }

  const page = await context.newPage();

  /* Login se necessário (sem session salva ou session expirou) */
  if (!savedState && process.env.ML_USER) {
    const ok = await loginIfNeeded(page);
    if (ok) {
      const newState = await context.storageState();
      await saveSession(sql, newState);
    }
  }

  let totalCount = 0;
  let ok = false;
  let errMsg = null;

  try {
    await warmup(page);
    /* Throttle entre warmup e busca real */
    await page.waitForTimeout(3000 + Math.floor(Math.random() * 2000));

    const items = await scrapeTerm(page, termo);
    if (items.length > 0) {
      ok = true;
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
    } else {
      errMsg = `sem anúncios em "${termo.q}"`;
    }

    /* Limpa registros velhos (>14 dias) */
    await sql`DELETE FROM ml_offers_cache WHERE scraped_at < NOW() - INTERVAL '14 days'`;

    /* Atualiza status */
    await sql`
      UPDATE ml_scrape_status SET
        last_run_at = NOW(),
        last_run_count = ${totalCount},
        last_run_status = ${ok ? 'ok' : 'failed'},
        last_run_termos = ${ok ? 1 : 0},
        last_error = ${errMsg}
      WHERE id = 1
    `;

    console.log(`[ml] FIM. Termo "${termo.q}" ${ok ? 'OK' : 'FAIL'}. Anúncios: ${totalCount}.`);
  } finally {
    await browser.close();
  }

  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('[ml] erro fatal:', err);
  process.exit(1);
});
