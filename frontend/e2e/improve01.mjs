// The workflow fixes from improve01.md, in a real browser: one-tap welcome and a 4-step tour,
// deliveries only through Maal aaya, the whole-shop budget saved as real orders, restock
// links landing on the right distributor, tomorrow's brief on Today after closing, and
// returning to the customer after an udhaar.
//
// It CHANGES data, so run it only against a scratch backend (see e2e/workflow.mjs):
//   node e2e/improve01.mjs e2e-shots
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5180';
const OUT = process.argv[2] ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.E2E_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

const problems = [];
async function newPage(viewport, { lang = 'english', onboarded = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(([l, done]) => {
    localStorage.setItem('hisaab_lang', l);
    if (done) localStorage.setItem('hisaab_onboarding_v2', 'done');
  }, [lang, onboarded]);
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

// ---- A. welcome: one tap in; the tour is 4 steps and ends on the mic -------------------
const fresh = await newPage({ width: 390, height: 844 }, { onboarded: false });
await step('welcome: one tap and you are in the shop', async () => {
  await fresh.goto(`${BASE}/app`);
  await fresh.getByRole('button', { name: /English/ }).click();
  await fresh.locator('[data-tour="day-bar"]').waitFor({ timeout: 10000 });
  if (await fresh.getByRole('dialog', { name: /Welcome/ }).count()) throw new Error('welcome still open');
});
await step('tour: 4 steps, the last one is the mic', async () => {
  await fresh.locator('[data-tour="help"]').click();
  await fresh.getByRole('button', { name: /show me around/i }).click();
  for (let i = 0; i < 3; i++) {
    await fresh.getByRole('button', { name: /^Next$/ }).click();
  }
  await fresh.getByText('Just say it').waitFor();
  await fresh.screenshot({ path: `${OUT}/imp-1-tour-mic.png` });
  await fresh.getByRole('button', { name: /Done|Finish|Got it/ }).first().click();
});

const desk = await newPage({ width: 1366, height: 900 });
await desk.goto(`${BASE}/app`);

// ---- B. budget plan saves real orders ---------------------------------------------------
let pendingBefore = 0;
await step('/app/buy opens the budget mode of Order', async () => {
  pendingBefore = (await api(desk, '/api/orders?status=pending')).length;
  await desk.goto(`${BASE}/app/buy`);
  await desk.waitForURL(/\/app\/order\?mode=budget/);
  await desk.getByRole('radio', { name: 'Whole shop, one budget' }).waitFor();
  if ((await desk.getByRole('radio', { name: 'Whole shop, one budget' }).getAttribute('aria-checked')) !== 'true') throw new Error('budget mode not selected');
});
await step('save the plan as orders: they appear under On the way', async () => {
  const save = desk.getByRole('button', { name: /Save as orders/ });
  await save.waitFor({ timeout: 20000 });
  await desk.waitForTimeout(800); // plan settles (debounced budget)
  await save.click();
  await desk.getByText(/orders saved:/).waitFor({ timeout: 15000 });
  const pending = (await api(desk, '/api/orders?status=pending')).length;
  if (pending <= pendingBefore) throw new Error(`pending orders ${pendingBefore} -> ${pending}`);
  await desk.screenshot({ path: `${OUT}/imp-2-plan-saved.png`, fullPage: true });
});

// ---- C. product sheet: deliveries go through Maal aaya ----------------------------------
await step('product sheet sends a delivery to Maal aaya', async () => {
  const orders = await api(desk, '/api/orders?status=pending');
  const line = orders[0].lines[0];
  await desk.goto(`${BASE}/app/stock`);
  await desk.getByRole('searchbox').first().fill(line.name.split(' ').slice(0, 2).join(' '));
  await desk.getByText(line.name, { exact: true }).first().click();
  await desk.getByText('Delivery came?').waitFor();
  if (await desk.getByRole('radio', { name: 'Delivery came' }).count()) throw new Error('the old manual "Delivery came" is still there');
  await desk.getByRole('radio', { name: 'Found more' }).waitFor();
  await desk.screenshot({ path: `${OUT}/imp-3-product.png` });
  await desk.getByRole('button', { name: /Check the bill:/ }).first().click();
  await desk.getByRole('dialog').getByText(/Maal aaya|Delivery/).first().waitFor();
  await desk.keyboard.press('Escape');
});

// ---- D. restock job lands on that product's distributor ---------------------------------
await step('a restock link opens the right distributor', async () => {
  const product = (await api(desk, '/api/products?search=Dalda')).products[0];
  await desk.goto(`${BASE}/app/order?product=${product.product_id}`);
  await desk.getByRole('heading', { name: new RegExp(`Order for ${product.supplier_name}`) }).waitFor({ timeout: 15000 });
});

// ---- E. return to the customer after an udhaar -------------------------------------------
await step('closing an udhaar returns to the customer', async () => {
  await desk.goto(`${BASE}/app/khata`);
  const imran = (await api(desk, '/api/credit/customers?search=Imran'))[0];
  await desk.getByText(imran.name).first().click();
  await desk.getByRole('dialog').getByRole('button', { name: /\+ ?Udhaar|Give udhaar|Udhaar/ }).first().click();
  await desk.getByRole('dialog', { name: 'Give udhaar' }).waitFor();
  await desk.keyboard.press('Escape');
  await desk.getByRole('dialog', { name: new RegExp(imran.name) }).waitFor({ timeout: 5000 });
  await desk.keyboard.press('Escape');
});

// ---- F. close the day: tomorrow's brief stays on Today ----------------------------------
await step("after closing, tomorrow's brief is on Today", async () => {
  const today = await api(desk, '/api/day/today');
  if (today.state === 'not_opened') {
    await api(desk, '/api/day/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counted_cash: today.cash_in_drawer_expected_pkr }) });
  }
  const now = await api(desk, '/api/day/today');
  if (now.state === 'open') {
    await api(desk, '/api/day/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counted_cash: now.cash_in_drawer_expected_pkr }) });
  }
  await desk.goto(`${BASE}/app`);
  await desk.locator('[data-tour="tomorrow"]').waitFor({ timeout: 10000 });
  await desk.locator('[data-tour="tomorrow"]').getByText(/^Tomorrow,/).waitFor();
  await desk.screenshot({ path: `${OUT}/imp-4-tomorrow.png` });
});

await browser.close();
console.log(problems.length ? `\nProblems:\n${[...new Set(problems)].join('\n')}` : '\nNo console errors or failed requests.');
process.exit(failed ? 1 : 0);
