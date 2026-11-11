// Optional browser check: set PLAYWRIGHT_MODULE to an installed Playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const { createServer } = require('node:net');
const assert = require('node:assert/strict');
const Database = require('../backend/node_modules/better-sqlite3');
const root = resolve(__dirname, '..');
const output = join(root, 'tmp', 'browser-smoke');
const directory = mkdtempSync(join(tmpdir(), 'cookbook-browser-'));
const children = [];
const exits = [];
let browser;
async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function launch(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  children.push(child);
  exits.push(new Promise(resolve => child.once('exit', resolve)));
  return () => log;
}
async function ready(url, logs) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Server failed to start: ' + logs());
}
async function main() {
  mkdirSync(output, { recursive: true });
  const dbPath = join(directory, 'test.db');
  const db = new Database(join(root, 'backend/dev.db'), { readonly: true });
  await db.backup(dbPath); db.close();
  const apiPort = await freePort(), uiPort = await freePort();
  const apiLog = launch(['--require', './tests/gemini-stub.cjs', 'dist/src/main.js'], join(root, 'backend'), { PORT: String(apiPort), HOST: '127.0.0.1', DATABASE_URL: `file:${dbPath.replaceAll('\\', '/')}`, JWT_SECRET: randomBytes(32).toString('hex'), GEMINI_API_KEY: 'test-not-real' });
  const uiLog = launch(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'], join(root, 'frontend'), { API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` });
  await ready(`http://127.0.0.1:${apiPort}/api/v1/health`, apiLog);
  const url = `http://127.0.0.1:${uiPort}`;
  await ready(url, uiLog);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/')) requests.push({ path: new URL(response.url()).pathname, method: response.request().method(), status: response.status() }); });

  const email = 'community-'+Date.now()+'@example.com';
  await page.goto(url+'/register');
  await page.getByLabel('Ім’я',{exact:true}).fill('Тестовий кухар');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Пароль',{exact:true}).fill('Test-password-2026!');
  await page.getByLabel('Підтвердження пароля',{exact:true}).fill('Test-password-2026!');
  await page.getByRole('button',{name:'Зареєструватися',exact:true}).click();
  await page.waitForURL('**/dashboard');
  await page.getByText('Ви увійшли як '+email).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Інгредієнт',exact:true}).count(),0);
  await page.getByRole('button',{name:'+ Новий інгредієнт',exact:true}).click();
  await page.getByLabel('Нова категорія',{exact:true}).fill('Соуси '+Date.now());
  await page.getByRole('button',{name:'Додати категорію',exact:true}).click();
  await page.getByLabel('Нова категорія',{exact:true}).fill('');
  await page.getByLabel('Назва інгредієнта',{exact:true}).fill('Тестовий песто');
  await page.getByLabel('Емодзі продукту (необов’язково)',{exact:true}).fill('🌿');
  await page.getByRole('button',{name:'Створити інгредієнт',exact:true}).click();
  await page.getByRole('checkbox',{name:'Додати Тестовий песто',exact:true}).waitFor();
  await page.getByRole('button',{name:'Додати обрані',exact:true}).click();
  await page.getByRole('button',{name:'Видалити Тестовий песто',exact:true}).waitFor();
  await page.getByRole('button',{name:'Обрати кілька продуктів',exact:true}).click();
  await page.getByLabel('Тип продуктів',{exact:true}).selectOption('Овочі');
  await page.getByRole('checkbox',{name:'Додати Помідор',exact:true}).check();
  await page.getByRole('button',{name:'Додати обрані',exact:true}).click();
  await page.getByRole('button',{name:'Видалити Помідор',exact:true}).waitFor();
  assert.equal(await page.getByRole('tab').count(),4);
  await page.getByRole('link',{name:'+ Створити рецепт',exact:true}).click();
  await page.getByLabel('Назва страви',{exact:true}).fill('Спільний салат');
  await page.getByLabel('Короткий опис',{exact:true}).fill('**Смачний** салат');
  await page.getByLabel('Спосіб приготування',{exact:true}).fill('## Кроки\n\n1. Нарізати\n2. Подати\n\n| Продукт | Маса |\n| --- | --- |\n| Помідор | 200 г |\n\n- [x] Готово');
  await page.getByLabel('Продукт 1',{exact:true}).selectOption({label:'Помідор'});
  await page.getByRole('checkbox',{name:'Показувати в браузері рецептів спільноти',exact:true}).check();
  await page.getByRole('button',{name:'Зберегти рецепт',exact:true}).click();
  await page.getByRole('heading',{name:'Спільний салат',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Кроки',exact:true}).waitFor();
  assert.equal(await page.locator('.markdown table').count(),1);
  await page.getByText('✓ Усі обов’язкові продукти є у холодильнику',{exact:true}).waitFor();
  const recipeUrl=page.url();
  await page.getByRole('button',{name:'Оцінити на 5',exact:true}).click();
  await page.getByText('★ 5.0 · 1 оцінок',{exact:true}).waitFor();
  await page.getByLabel('Ваш коментар',{exact:true}).fill('Дуже смачно!');
  await page.getByRole('button',{name:'Додати коментар',exact:true}).click();
  await page.getByText('Дуже смачно!',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Мій профіль',exact:true}).click();
  await page.getByLabel('Ім’я',{exact:true}).fill('Шеф Тест');
  await page.getByLabel('Про себе',{exact:true}).fill('## Моя кухня\nЛюблю **салати**.');
  await page.getByRole('checkbox',{name:'Показувати мої оприлюднені рецепти у профілі',exact:true}).check();
  await page.getByRole('button',{name:'Зберегти профіль',exact:true}).click();
  await page.getByText('Профіль збережено',{exact:true}).waitFor();
  await page.goto(recipeUrl);
  await page.getByRole('link',{name:'Шеф Тест',exact:true}).click();
  await page.getByRole('heading',{name:'Шеф Тест',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Спільний салат',exact:true}).waitFor();
  await page.getByRole('link',{name:'Головна',exact:true}).click();
  await page.getByRole('tab',{name:'Браузер рецептів',exact:true}).click();
  await page.getByRole('heading',{name:'Спільний салат',exact:true}).waitFor();
  await page.screenshot({path:join(output,'community-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(output,'community-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Видалити Помідор',exact:true}).click();
  await page.getByRole('button',{name:'Видалити Помідор',exact:true}).waitFor({state:'hidden'});
  await page.goto(recipeUrl);
  await page.getByText('Дуже смачно!',{exact:true}).waitFor();
  await page.locator('.missing-pill').filter({hasText:'Помідор'}).waitFor();
  await page.screenshot({path:join(output,'markdown-recipe-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: community browser flow, markdown, categories, emoji, picker, tabs, rating, comments, profiles, mobile');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  for (const child of children) child.kill();
  await Promise.all(exits);
  rmSync(directory, { recursive: true, force: true });
});
