// "Bol kar likhein" for goods (Phase B), in a real browser with a recording played into a
// fake microphone: items heard and matched to the shelf, quantities in the product's unit,
// shelf prices, stock going down, the cash box unchanged. Then, typed on desktop, an
// ambiguous item ("Dalda": oil or ghee?) that waits for the shopkeeper to choose.
//
// It CHANGES data and calls the online AI, so run it only against a scratch backend
// (see e2e/voice.mjs for the commands), after allowing voice once:
//   node e2e/voice-goods.mjs <recording.wav> e2e-shots
// The recording should say, e.g.: "Imran, do kilo cheeni, teen Lux sabun, aur ek Dalda ghee udhaar le gaya".
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5180';
const WAV = resolve(process.argv[2] ?? 'goods.wav');
const OUT = process.argv[3] ?? 'e2e-shots';
const SECONDS = Number(process.env.E2E_SPEAK_SECONDS ?? 10);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.E2E_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`],
});
const problems = [];
async function newPage(viewport, lang) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, permissions: ['microphone'] });
  await ctx.addInitScript((l) => {
    localStorage.setItem('hisaab_lang', l);
    localStorage.setItem('hisaab_onboarding_v2', 'done');
  }, lang);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.request().method()} ${r.url()}`));
  return page;
}
let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log('ok  ', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name, '-', e.message.split('\n').slice(0, 8).join(' | '));
  }
};
const api = (page, path, init) => page.evaluate(async ([p, i]) => (await fetch(p, i)).json(), [path, init]);
const cash = async (page) => (await api(page, '/api/day/today')).cash_in_drawer_expected_pkr;
const stockOf = async (page, search) => (await api(page, `/api/products?search=${encodeURIComponent(search)}`)).products[0];

// ---- phone, spoken goods ------------------------------------------------------------
const phone = await newPage({ width: 390, height: 844 }, 'roman_urdu');
let before = 0;
let sugarBefore = 0;
await step('speak three items', async () => {
  await phone.goto(`${BASE}/app`);
  await api(phone, '/api/voice/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cloud_allowed: true }) });
  before = await cash(phone);
  sugarBefore = (await stockOf(phone, 'Cheeni')).stock_qty;
  await phone.reload();
  await phone.locator('[data-tour="voice"]').click();
  await phone.getByRole('button', { name: 'Bas, samjho' }).waitFor({ timeout: 8000 }); // listening started on open
  await phone.waitForTimeout(SECONDS * 1000);
  await phone.getByRole('button', { name: 'Bas, samjho' }).click();
  await phone.getByRole('button', { name: 'Haan, likh do' }).waitFor({ timeout: 60000 });
});
await step('items matched with quantities and shelf prices', async () => {
  const dialog = phone.getByRole('dialog');
  for (const name of ['Loose White Sugar (Cheeni) 1kg', 'Lux Soft Touch Soap 115g', 'Dalda Banaspati Ghee 1kg Pouch']) {
    await dialog.getByText(name, { exact: true }).waitFor({ timeout: 5000 });
  }
  const qtys = await dialog.locator('ul.parchi input[inputmode="decimal"]').evaluateAll((els) => els.map((e) => e.value));
  if (qtys.join(',') !== '2,3,1') throw new Error(`quantities ${qtys}`);
  if (!(await phone.getByRole('button', { name: 'Haan, likh do' }).isEnabled())) throw new Error('save is disabled');
  await phone.screenshot({ path: `${OUT}/goods-1-review.png`, fullPage: true });
});
await step('save: stamp, receipt with items, stock down, cash box same', async () => {
  await phone.getByRole('button', { name: 'Haan, likh do' }).click();
  await phone.getByText('Likh diya.').waitFor({ timeout: 15000 });
  await phone.getByText('Loose White Sugar (Cheeni) 1kg: 2 x', { exact: false }).first().waitFor();
  await phone.screenshot({ path: `${OUT}/goods-2-saved.png`, fullPage: true });
  const after = await cash(phone);
  if (Math.abs(after - before) > 0.01) throw new Error(`cash box ${before} -> ${after}`);
  const sugarAfter = (await stockOf(phone, 'Cheeni')).stock_qty;
  if (Math.abs(sugarBefore - 2 - sugarAfter) > 1e-6) throw new Error(`sugar stock ${sugarBefore} -> ${sugarAfter}`);
});

// ---- desktop, typed, an item that needs a choice --------------------------------------
const desk = await newPage({ width: 1366, height: 900 }, 'english');
await step('ambiguous "Dalda" waits for a choice', async () => {
  await desk.goto(`${BASE}/app`);
  await desk.locator('[data-tour="voice-side"]').click();
  await desk.getByRole('button', { name: 'Or type it' }).click();
  await desk.locator('#voice-text').fill('Tariq bhai Dalda aur do double roti le gaya');
  await desk.getByRole('button', { name: 'Understand', exact: true }).click();
  await desk.getByRole('button', { name: 'Yes, write it' }).waitFor({ timeout: 60000 });
  await desk.getByText('Which one?').first().waitFor();
  if (await desk.getByRole('button', { name: 'Yes, write it' }).isEnabled()) throw new Error('saving allowed before choosing Dalda');
  await desk.screenshot({ path: `${OUT}/goods-3-choose.png` });
  await desk.getByRole('button', { name: /Dalda Banaspati Ghee 1kg Pouch/ }).click();
  await desk.getByRole('button', { name: 'Yes, write it' }).click();
  await desk.getByText('Written in the book.').waitFor({ timeout: 15000 });
  await desk.screenshot({ path: `${OUT}/goods-4-saved.png` });
});

await browser.close();
console.log(problems.length ? `\nProblems:\n${[...new Set(problems)].join('\n')}` : '\nNo console errors or failed requests.');
process.exit(failed ? 1 : 0);
