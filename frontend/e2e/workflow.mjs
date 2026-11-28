// Walks the daily workflow in a real browser, the way a shopkeeper would: open the day,
// udhaar with items, "Udhaar dun?", wasooli by Easypaisa, kharcha, an order booker order,
// maal aaya with a rate change, ginti, paying a distributor, closing the day, the khata
// history, the business report (screen and print), and the main screens on a phone.
//
// It CHANGES data, so run it only against a scratch backend, never your own database:
//   cd backend && DATABASE_URL=sqlite:///scratch.db python -m uvicorn app.main:app --port 8010
//   cd frontend && BACKEND_URL=http://127.0.0.1:8010 npx vite --port 5180
//   cd frontend && npm i --no-save playwright-core && node e2e/workflow.mjs e2e-shots
// Reset the scratch data between runs: POST /api/demo/reset with header x-demo-key.
// Uses the installed Edge (E2E_BROWSER to change it). Exit output lists every console
// error, failed request and horizontal overflow found.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5180';
const OUT = process.argv[2] ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.E2E_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

const problems = [];
async function newPage(viewport, lang = 'english') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
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
const idle = (p) => p.waitForLoadState('networkidle').catch(() => {});
const step = async (name, fn) => {
  try {
    await fn();
    console.log('ok  ', name);
  } catch (e) {
    console.log('FAIL', name, '-', e.message.split('\n').slice(0, 14).join(' | '));
    if (globalThis.cur) await globalThis.cur.screenshot({ path: `${OUT}/FAIL-${name.replace(/[^a-z]+/gi, '_')}.png` }).catch(() => {});
    problems.push(`step ${name}: ${e.message.split('\n')[0]}`);
  }
};
const dialog = (p) => p.locator('[role="dialog"]').last();
const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const closeSheet = async (p) => {
  await p.keyboard.press('Escape');
  await p.waitForTimeout(450);
};

const d = await newPage({ width: 1366, height: 900 });
globalThis.cur = d;
globalThis.cur = d;

await step('today loads with day bar and quick actions', async () => {
  await d.goto(BASE + '/app');
  await idle(d);
  await d.waitForSelector('[data-tour="day-bar"]', { timeout: 15000 });
  await d.waitForSelector('[data-tour="quick-actions"]');
  await d.waitForTimeout(1800); // register opens
  await shot(d, 'desk-today', true);
});

await step('udhaar with items, credit check, receipt', async () => {
  await d.click('[data-tour="quick-udhaar"]');
  const sheet = dialog(d);
  await sheet.getByText('Haji Abdul Rasheed').first().click();
  const search = sheet.getByPlaceholder('Add an item: Dalda, Surf, doodh...');
  await search.fill('Dalda');
  await sheet.locator('ul button:has-text("Dalda")').first().click();
  await search.fill('Surf');
  await sheet.locator('ul button:has-text("Surf")').first().click();
  await sheet.getByText('Udhaar dun?', { exact: false }).first().waitFor({ timeout: 8000 });
  await d.waitForTimeout(700);
  await shot(d, 'desk-udhaar-entry');
  await d.getByRole('button', { name: /Write in khata|Give anyway/ }).click();
  await sheet.getByText('Written in the khata.').waitFor({ timeout: 8000 });
  await d.waitForTimeout(700);
  await shot(d, 'desk-udhaar-receipt');
  await sheet.getByRole('button', { name: 'Show customer' }).click();
  await d.waitForTimeout(500);
  await shot(d, 'desk-udhaar-fullscreen');
  await d.getByRole('button', { name: 'Close' }).last().click();
  await d.waitForTimeout(300);
  await closeSheet(d);
});

await step('credit check says no for a late payer', async () => {
  await d.click('[data-tour="quick-udhaar"]');
  const sheet = dialog(d);
  await sheet.getByPlaceholder('Customer name or phone').fill('Tariq');
  await sheet.getByText('Tariq Mahmood').first().click();
  await sheet.getByText('Other amount', { exact: false }).first().click();
  await sheet.getByLabel('Other amount').fill('2000');
  await sheet.getByText('Better not', { exact: false }).waitFor({ timeout: 8000 });
  await shot(d, 'desk-udhaar-no');
  await closeSheet(d);
});

await step('wasooli by easypaisa with receipt', async () => {
  await d.getByRole('button', { name: /\+ Wasooli/ }).first().click();
  const sheet = dialog(d);
  await sheet.getByText('Haji Abdul Rasheed').first().click();
  await sheet.locator('input[id^="pay-"]').fill('1500');
  await sheet.getByRole('radio', { name: /Easypaisa/ }).click();
  await sheet.getByRole('button', { name: 'Save payment' }).click();
  await sheet.getByText('Payment saved.').waitFor({ timeout: 8000 });
  await d.waitForTimeout(600);
  await shot(d, 'desk-wasooli');
  await closeSheet(d);
});

await step('kharcha from the galla', async () => {
  await d.getByRole('button', { name: /Kharcha/ }).first().click();
  const sheet = dialog(d);
  await sheet.getByRole('radio', { name: /Electricity/ }).click();
  await sheet.locator('#exp-amount').fill('800');
  await sheet.getByRole('button', { name: 'Save kharcha' }).click();
  await sheet.getByText('Written in the book.').waitFor({ timeout: 8000 });
  await closeSheet(d);
});

let ordered = false;
await step('order booker: suggest, edit, save, draft', async () => {
  await d.goto(BASE + '/app/order');
  await idle(d);
  await d.getByRole('button', { name: 'Make order' }).first().waitFor({ timeout: 15000 });
  await shot(d, 'desk-order', true);
  await d.getByRole('button', { name: 'Make order' }).first().click();
  await d.getByRole('button', { name: 'Save order' }).waitFor({ timeout: 15000 });
  await d.waitForTimeout(800);
  await shot(d, 'desk-order-builder', true);
  await d.getByRole('button', { name: 'Save order' }).click();
  await d.getByText('Order saved.').waitFor({ timeout: 8000 });
  await d.waitForTimeout(600);
  await shot(d, 'desk-order-saved', true);
  ordered = true;
});

await step('maal aaya: rate change flagged, stock in', async () => {
  if (!ordered) throw new Error('no order to receive');
  await d.goto(BASE + '/app/order');
  await idle(d);
  await d.getByRole('button', { name: 'Maal aaya' }).first().click();
  const sheet = dialog(d);
  const rate = sheet.locator('input[inputmode="decimal"]').nth(1);
  const now = Number(await rate.inputValue());
  await rate.fill(String(Math.round(now * 1.1)));
  await sheet.getByText('Rate up', { exact: false }).first().waitFor();
  await sheet.locator('#bill-no').fill('INV-2231');
  await shot(d, 'desk-receive-form');
  await sheet.getByRole('button', { name: /Maal aaya: add to stock/ }).click();
  await sheet.getByText('Stock added to the shelf.').waitFor({ timeout: 8000 });
  await d.waitForTimeout(700);
  await shot(d, 'desk-receive-done');
  const fix = sheet.getByRole('button', { name: /Set price to/ });
  if (await fix.count()) {
    await fix.first().click();
    await sheet.getByText('Shelf price is now', { exact: false }).waitFor({ timeout: 8000 });
  }
  await closeSheet(d);
});

await step('ginti: count, shortfall as sales', async () => {
  await d.goto(BASE + '/app/stock/count');
  await idle(d);
  await d.getByRole('button', { name: /same as records/ }).first().waitFor({ timeout: 15000 });
  const same = d.getByRole('button', { name: /same as records/ });
  for (let i = 0; i < 3; i++) await same.nth(i).click();
  const inputs = d.getByPlaceholder('Count');
  await inputs.nth(3).fill('1');
  await d.getByRole('radio', { name: 'Sold, not written' }).click();
  await shot(d, 'desk-ginti', true);
  await d.getByRole('button', { name: /Save count/ }).click();
  await d.getByText('Count saved.', { exact: false }).waitFor({ timeout: 8000 });
  await d.waitForTimeout(500);
  await shot(d, 'desk-ginti-done', true);
});

await step('hisaab: pay a distributor', async () => {
  await d.goto(BASE + '/app/hisaab');
  await idle(d);
  await d.getByRole('button', { name: 'Pay' }).first().waitFor({ timeout: 15000 });
  await d.waitForTimeout(800);
  await shot(d, 'desk-hisaab', true);
  await d.getByRole('button', { name: 'Pay' }).first().click();
  const sheet = dialog(d);
  await sheet.locator('#pay-sup').fill('1000');
  await sheet.getByRole('button', { name: 'Save payment' }).click();
  await sheet.getByText('Payment written in the book.').waitFor({ timeout: 8000 });
  await closeSheet(d);
});

await step('close the day with a short galla', async () => {
  await d.goto(BASE + '/app');
  await idle(d);
  await d.locator('[data-tour="day-bar"]').getByRole('button', { name: 'Close the day' }).click();
  const sheet = dialog(d);
  await sheet.getByText('The records say the cash box should have').waitFor({ timeout: 8000 });
  const expectedText = await sheet.locator('p.text-3xl').first().innerText();
  const expected = Number(expectedText.replace(/[^\d]/g, ''));
  await sheet.locator('#galla').fill(String(expected - 300));
  await sheet.getByText('300 short', { exact: false }).waitFor();
  await shot(d, 'desk-close-form', true);
  await sheet.getByRole('button', { name: 'Close the day' }).click();
  await sheet.getByText('Day closed.').waitFor({ timeout: 8000 });
  await d.waitForTimeout(800);
  await shot(d, 'desk-close-done');
  await sheet.locator('div.overflow-y-auto').first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await d.waitForTimeout(300);
  await shot(d, 'desk-close-tomorrow');
  await closeSheet(d);
  await d.locator('[data-tour="day-bar"]').getByText('Day closed at', { exact: false }).waitFor();
});

await step('khata history shows items and method', async () => {
  await d.goto(BASE + '/app/khata');
  await idle(d);
  await d.getByText('Haji Abdul Rasheed').first().click();
  const sheet = dialog(d);
  await sheet.getByText('Khata history').waitFor({ timeout: 8000 });
  await sheet.getByText('Easypaisa').first().waitFor();
  await sheet.getByText('Khata history').scrollIntoViewIfNeeded();
  await d.waitForTimeout(400);
  await shot(d, 'desk-khata-history');
  await closeSheet(d);
});

await step('report renders and prints', async () => {
  await d.goto(BASE + '/app/report');
  await idle(d);
  await d.getByText('Month by month').waitFor({ timeout: 15000 });
  await shot(d, 'desk-report', true);
  await d.emulateMedia({ media: 'print' });
  await shot(d, 'desk-report-print', true);
  await d.emulateMedia({ media: 'screen' });
});

// ---- phone ------------------------------------------------------------------
const m = await newPage({ width: 390, height: 844 }, 'roman_urdu');
globalThis.cur = m;
await step('phone today', async () => {
  await m.goto(BASE + '/app');
  await idle(m);
  await m.waitForSelector('[data-tour="quick-actions"]');
  await m.waitForTimeout(1800);
  await shot(m, 'phone-today');
  await shot(m, 'phone-today-full', true);
});
await step('phone udhaar sheet', async () => {
  await m.click('[data-tour="quick-udhaar"]');
  const sheet = dialog(m);
  await sheet.getByText('Qari Sahab').first().click();
  const search = sheet.getByPlaceholder('Item daalein: Dalda, Surf, doodh...');
  await search.fill('atta');
  await sheet.locator('ul button').first().click();
  await m.waitForTimeout(1200);
  await shot(m, 'phone-udhaar');
  await m.getByRole('button', { name: /Khate mein likhein|Phir bhi dein/ }).click();
  await sheet.getByText('Khate mein likh diya.').waitFor({ timeout: 8000 });
  await m.waitForTimeout(600);
  await shot(m, 'phone-udhaar-receipt');
  await closeSheet(m);
});
await step('phone order + hisaab + ginti', async () => {
  for (const [route, name] of [['/app/order', 'order'], ['/app/hisaab', 'hisaab'], ['/app/stock/count', 'ginti'], ['/app/khata', 'khata'], ['/app/report', 'report']]) {
    await m.goto(BASE + route);
    await idle(m);
    await m.waitForTimeout(900);
    await shot(m, `phone-${name}`, true);
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`horizontal overflow ${overflow}px on ${route}`);
  }
});

await browser.close();
console.log('\nPROBLEMS:', problems.length ? '\n' + [...new Set(problems)].join('\n') : 'none');
