// Explicit live check: one Gemini call with synthetic data in a temporary DB.
const { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const root = resolve(__dirname, '..');
require('../backend/node_modules/dotenv').config({ path: join(root, 'backend/.env'), quiet: true });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    const data = await response.clone().json().catch(() => null);
    const key = process.env.GEMINI_API_KEY || '';
    console.log(JSON.stringify({ upstreamStatus: response.status, detail: String(data?.error?.message || '').split(key).join('[REDACTED]') }));
  }
  return response;
};
const Database = require('../backend/node_modules/better-sqlite3');
const { ConfigService } = require('../backend/node_modules/@nestjs/config');
const { PrismaService } = require('../backend/dist/src/prisma/prisma.service');
const { GeminiService } = require('../backend/dist/src/assistant/gemini.service');
const { AssistantService } = require('../backend/dist/src/assistant/assistant.service');
const directory = mkdtempSync(join(tmpdir(), 'cookbook-live-ai-'));
let prisma;
async function main() {
  const file = join(directory, 'test.db');
  const db = new Database(file);
  for (const entry of readdirSync(join(root, 'backend/prisma/migrations'), { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) db.exec(readFileSync(join(root, 'backend/prisma/migrations', entry.name, 'migration.sql'), 'utf8'));
  db.close();
  const config = new ConfigService({ DATABASE_URL: `file:${file.replaceAll('\\', '/')}` });
  prisma = new PrismaService(config); await prisma.$connect();
  const user = await prisma.user.create({ data: { name: 'AI Test', email: 'ai-fixture@example.test', passwordHash: 'not-a-login-account' } });
  const products = ['Яйце', 'Помідор', 'Олія'];
  for (const name of products) {
    const ingredient = await prisma.ingredient.create({ data: { name, category: 'Тестові продукти' } });
    await prisma.fridgeItem.create({ data: { userId: user.id, ingredientId: ingredient.id } });
  }
  const assistant = new AssistantService(prisma, new GeminiService(config));
  const prompt = 'Порадь одну страву з моїх продуктів на 15 хвилин, без молока. Дай короткі кроки.';
  const turn = await assistant.send(user.id, prompt);
  const history = await assistant.history(user.id);
  if (history.turns.length !== 1 || history.turns[0].reply !== turn.reply) throw new Error('Chat persistence failed');
  const result = { result: 'PASS', environment: 'Live Gemini, synthetic fridge, isolated temporary SQLite', products, prompt, reply: turn.reply, historySaved: true, retentionDays: history.retentionDays };
  mkdirSync(join(root, 'docs/evidence'), { recursive: true });
  writeFileSync(join(root, 'docs/evidence/gemini-live-smoke.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ result: result.result, historySaved: true, retentionDays: history.retentionDays, reply: turn.reply }));
}
main().catch(error => { console.error(JSON.stringify({ error: error.message, status: error.getStatus?.() })); process.exitCode = 1; }).finally(async () => {
  if (prisma) await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});
