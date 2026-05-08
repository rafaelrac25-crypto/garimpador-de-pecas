/**
 * Bootstrap manual da sessão Mercado Livre.
 *
 * OBJETIVO (leigo):
 *   Esse script abre uma janela do Chrome no SEU PC. Você loga no ML
 *   manualmente (digita email/senha, resolve captcha se aparecer, confirma
 *   2FA se pedir). Quando você terminar de logar, o script salva sua
 *   "carteirinha" de acesso no banco do app. O robô do GitHub usa essa
 *   carteirinha depois pra ver as ofertas sem precisar logar de novo.
 *
 * Uso:
 *   1. Crie .env neste diretório com: DATABASE_URL=postgresql://...
 *   2. cd scripts
 *   3. npm install playwright @neondatabase/serverless dotenv
 *   4. npx playwright install chromium
 *   5. node bootstrap-ml-session.js
 *   6. Loga manualmente na janela que abriu
 *   7. Espera mensagem "✓ Sessão salva!"
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL não encontrada. Crie um arquivo .env com:');
    console.error('   DATABASE_URL=postgresql://...\n');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('\n🚀 Abrindo janela do Chrome…');
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log('📍 Indo pra tela de login do ML…\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' AGORA É COM VOCÊ:');
  console.log(' 1. Loga normalmente na conta nova do ML');
  console.log(' 2. Resolve captcha/2FA se aparecer');
  console.log(' 3. Espera carregar a tela inicial do ML');
  console.log(' 4. NÃO FECHA a janela — o script detecta sozinho');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await page.goto('https://www.mercadolivre.com.br/jms/mlb/lgz/login');

  /* Aguarda login com sucesso. Detecta por URL — quando sair de /lgz/login
     E carregar página real do ML, login terminou. Timeout 10 minutos. */
  console.log('⏳ Aguardando você terminar de logar (até 10 min)…');
  try {
    await page.waitForFunction(
      () => !window.location.href.includes('/lgz/login') && document.readyState === 'complete',
      { timeout: 600000 }
    );
    /* Pequena espera adicional pra cookies estabilizarem */
    await page.waitForTimeout(3000);
  } catch (e) {
    console.error('\n❌ Tempo esgotado. Tente de novo.');
    await browser.close();
    process.exit(1);
  }

  const finalUrl = page.url();
  const finalTitle = await page.title();
  console.log(`\n✓ Login detectado! URL: ${finalUrl}`);
  console.log(`  Título: "${finalTitle}"`);

  /* Salva storage_state */
  const state = await context.storageState();
  const json = JSON.stringify(state);
  console.log(`📦 Storage state: ${json.length} bytes (cookies + localStorage)`);

  try {
    await sql`UPDATE ml_session SET storage_state = ${json}, saved_at = NOW() WHERE id = 1`;
    console.log('\n✅ Sessão salva no Neon! O robô do GitHub vai usar daqui pra frente.\n');
  } catch (err) {
    console.error('\n❌ Falha ao salvar:', err.message);
    if (err.message.includes('does not exist')) {
      console.error('   Rode primeiro: curl -X POST https://c14docosta.vercel.app/api/admin/init-schema');
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
