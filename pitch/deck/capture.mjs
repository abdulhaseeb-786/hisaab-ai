// Captures the real app screens used in the pitch deck (phone size, 2x for sharp projection).
// Run against a SCRATCH backend + Vite (see frontend/e2e/voice.mjs), never your own data:
//   node capture.mjs <dir-with-wavs>
// Needs: ali.wav, goods.wav, ask-imran.wav (spoken test sentences) in <dir-with-wavs>.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const WAVS = resolve(process.argv[2] ?? '.');
const OUT = resolve('assets/shots');
mkdirSync(OUT, { recursive: true });
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PHONE = { width: 390, height: 844 };

async function open(lang = 'roman_urdu', wav = null, viewport = PHONE) {
  const args = wav ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${resolve(WAVS, wav)}`] : [];
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, permissions: ['microphone'] });
  await ctx.addInitScript((l) => {
    localStorage.setItem('hisaab_lang', l);
    localStorage.setItem('hisaab_onboarding_v2', 'done');
  }, lang);
  const page = await ctx.newPage();
  return { browser, page };
}
const api = (page, path, init) => page.evaluate(async ([p, i]) => (await fetch(p, i)).json(), [path, init]);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const settle = (page, ms = 900) => page.waitForTimeout(ms);

async function speak(page, seconds) {
  await page.locator('[data-tour="voice"]').click();
  await page.getByRole('button', { name: 'Bas, samjho' }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(seconds * 1000);
  await page.getByRole('button', { name: 'Bas, samjho' }).click();
}

// 1. Today: the day bar, the counter buttons, and today's 3 jobs
{
  const { browser, page } = await open();
  await page.goto(`${BASE}/app`);
  await api(page, '/api/voice/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cloud_allowed: true }) });
  await page.reload();
  await page.locator('[data-tour="quick-actions"]').waitFor();
  await settle(page, 1500);
  await shot(page, 'today');
  await page.locator('[data-tour="first-job"]').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => { const el = document.querySelector('[data-tour="first-job"]'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 210); });
  await settle(page, 700);
  await shot(page, 'jobs');
  await browser.close();
}

// 2. Voice entry: Ali Butt, cash udhaar
{
  const { browser, page } = await open('roman_urdu', 'ali.wav');
  await page.goto(`${BASE}/app`);
  await speak(page, 12);
  await page.getByRole('button', { name: 'Haan, likh do' }).waitFor({ timeout: 60000 });
  await settle(page, 1200);
  await shot(page, 'voice-review');
  await page.getByRole('button', { name: 'Haan, likh do' }).click();
  await page.getByText('Likh diya.').waitFor({ timeout: 15000 });
  await settle(page, 1200);
  await shot(page, 'voice-saved');
  await browser.close();
}

// 3. Goods on udhaar: items matched to the shelf
{
  const { browser, page } = await open('roman_urdu', 'goods.wav');
  await page.goto(`${BASE}/app`);
  await speak(page, 10);
  await page.getByRole('button', { name: 'Haan, likh do' }).waitFor({ timeout: 60000 });
  await settle(page, 1000);
  await shot(page, 'goods-top');
  await page.getByText('Kya liya?').first().scrollIntoViewIfNeeded();
  await settle(page, 600);
  await shot(page, 'goods-items');
  await browser.close();
}

// 4. A spoken question, answered from the khata
{
  const { browser, page } = await open('roman_urdu', 'ask-imran.wav');
  await page.goto(`${BASE}/app`);
  await speak(page, 5);
  await page.getByText('HisaabAI ka jawab').waitFor({ timeout: 60000 });
  await settle(page, 1200);
  await shot(page, 'ask-answer');
  await browser.close();
}

// 5. Rs 50,000 for the whole shop
{
  const { browser, page } = await open();
  await page.goto(`${BASE}/app/order?mode=budget`);
  await page.getByRole('button', { name: /Order save karein/ }).waitFor({ timeout: 30000 });
  await page.getByText('Aap ka order').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -330));
  await settle(page, 1200);
  await shot(page, 'budget-plan');
  await browser.close();
}

// 6. The khata line written by voice, with its recording
{
  const { browser, page } = await open();
  await page.goto(`${BASE}/app/khata`);
  const ali = (await api(page, '/api/credit/customers?search=Ali')).find((c) => /\bali\b/i.test(c.name));
  await page.getByText(ali.name).first().click();
  await page.getByText('awaaz se').first().waitFor();
  await settle(page, 900);
  await shot(page, 'khata-voice');
  await browser.close();
}

// 7. Business report for a loan (desktop, English)
{
  const { browser, page } = await open('english', null, { width: 1280, height: 860 });
  await page.goto(`${BASE}/app/report`);
  await settle(page, 2500);
  await shot(page, 'report');
  await browser.close();
}

// 8. Desktop Today (the signboard sidebar)
{
  const { browser, page } = await open('english', null, { width: 1440, height: 900 });
  await page.goto(`${BASE}/app`);
  await page.locator('[data-tour="quick-actions"]').waitFor();
  await settle(page, 1800);
  await shot(page, 'desktop-today');
  await browser.close();
}
console.log('captured to', OUT);
