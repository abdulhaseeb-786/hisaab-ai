// Walks "bol kar likhein" in a real browser with a real recording played into a fake
// microphone: consent, hold-to-talk, what was heard (Urdu + Roman), the review card,
// saving, the stamp, the khata line with its recording, and the galla going down.
// Then the typed path on desktop.
//
// It CHANGES data and calls the online AI, so run it only against a scratch backend:
//   cd backend && DATABASE_URL=sqlite:///scratch.db VOICE_DIR=scratch-voice python -m uvicorn app.main:app --port 8010
//   cd frontend && BACKEND_URL=http://127.0.0.1:8010 npx vite --port 5180
//   cd frontend && npm i --no-save playwright-core && node e2e/voice.mjs <recording.wav> e2e-shots
// The recording should say an udhaar for a new person, e.g. "Aaj Ali Butt mujh se paanch
// hazaar rupay udhaar le kar gaya, beti ki fees ke liye" (16 kHz mono WAV).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5180';
const WAV = resolve(process.argv[2] ?? 'ali.wav');
const OUT = process.argv[3] ?? 'e2e-shots';
const SECONDS = Number(process.env.E2E_SPEAK_SECONDS ?? 12);
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
const api = async (page, path, init) => page.evaluate(async ([p, i]) => (await fetch(p, i)).json(), [path, init]);
const cash = async (page) => (await api(page, '/api/day/today')).cash_in_drawer_expected_pkr;

// ---- phone, Roman Urdu, spoken -------------------------------------------------------
const phone = await newPage({ width: 390, height: 844 }, 'roman_urdu');
let before = 0;
await step('open Today with the mic', async () => {
  await phone.goto(`${BASE}/app`);
  await api(phone, '/api/voice/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cloud_allowed: false }) });
  await phone.reload();
  await phone.locator('[data-tour="voice"]').waitFor();
  before = await cash(phone);
  await phone.screenshot({ path: `${OUT}/voice-1-today.png` });
});
await step('consent first, then the mic', async () => {
  await phone.locator('[data-tour="voice"]').click();
  await phone.getByRole('button', { name: 'Haan, ijazat hai' }).click();
  await phone.getByRole('button', { name: 'Daba kar bolein' }).waitFor();
  await phone.screenshot({ path: `${OUT}/voice-2-listen.png` });
});
await step('speak, then see what was understood', async () => {
  await phone.getByRole('button', { name: 'Daba kar bolein' }).click();
  await phone.getByText('Sun raha hoon').waitFor({ timeout: 8000 });
  await phone.waitForTimeout(SECONDS * 1000);
  await phone.screenshot({ path: `${OUT}/voice-3-recording.png` });
  await phone.getByRole('button', { name: 'Bas, samjho' }).click();
  await phone.getByRole('button', { name: 'Haan, likh do' }).waitFor({ timeout: 40000 });
  const amount = await phone.locator('#voice-amount').inputValue();
  if (amount !== '5,000') throw new Error(`amount is "${amount}"`);
  const name = await phone.locator('#voice-new-name').inputValue();
  if (!/\bali\b/i.test(name)) throw new Error(`new khata name is "${name}"`);
  await phone.getByRole('dialog').locator('p[dir="rtl"][lang="ur"]').first().waitFor();
  await phone.screenshot({ path: `${OUT}/voice-4-review.png`, fullPage: true });
});
await step('save: stamp, and the galla goes down', async () => {
  await phone.getByRole('button', { name: 'Haan, likh do' }).click();
  await phone.getByText('Likh diya.').waitFor({ timeout: 15000 });
  await phone.screenshot({ path: `${OUT}/voice-5-saved.png`, fullPage: true });
  const after = await cash(phone);
  if (Math.abs(before - 5000 - after) > 0.01) throw new Error(`galla ${before} -> ${after}`);
  await phone.getByRole('button', { name: 'Theek hai' }).click();
});
await step('khata line shows voice and plays the recording', async () => {
  const customers = await api(phone, '/api/credit/customers?search=Ali');
  const ali = customers.find((c) => /\bali\b/i.test(c.name));
  if (!ali) throw new Error('no Ali khata');
  const ledger = await api(phone, `/api/credit/customers/${ali.customer_id}`);
  const line = ledger.entries[0];
  if (!line.cash_loan || !line.has_recording) throw new Error(JSON.stringify(line));
  const audio = await phone.evaluate(async (id) => {
    const r = await fetch(`/api/voice/captures/${id}/audio`);
    return [r.status, r.headers.get('content-type'), (await r.arrayBuffer()).byteLength];
  }, line.voice_capture_id);
  if (audio[0] !== 200 || audio[2] < 10000) throw new Error(`audio ${audio}`);
  await phone.goto(`${BASE}/app/khata`);
  await phone.getByText(ali.name).first().click();
  await phone.getByText('awaaz se').first().waitFor();
  await phone.locator('audio').first().waitFor();
  await phone.screenshot({ path: `${OUT}/voice-6-khata.png`, fullPage: true });
});

// ---- desktop, English, typed ---------------------------------------------------------
const desk = await newPage({ width: 1366, height: 900 }, 'english');
await step('typed wasooli on desktop', async () => {
  await desk.goto(`${BASE}/app`);
  await desk.locator('[data-tour="voice-side"]').click();
  // Opening from the mic starts listening (permission was given above).
  await desk.getByRole('button', { name: 'Stop and understand' }).waitFor({ timeout: 8000 });
  await desk.getByRole('button', { name: 'Or type it' }).click();
  await desk.getByRole('button', { name: 'Hold to speak' }).waitFor();
  await desk.locator('#voice-text').fill('Imran ne 500 wapas diye jazz cash pe');
  await desk.getByRole('button', { name: 'Understand', exact: true }).click();
  await desk.getByRole('button', { name: 'Yes, write it' }).waitFor({ timeout: 40000 });
  await desk.getByText('Imran Butt').first().waitFor();
  await desk.screenshot({ path: `${OUT}/voice-7-desktop-review.png` });
  await desk.getByRole('button', { name: 'Yes, write it' }).click();
  await desk.getByText('Written in the book.').waitFor({ timeout: 15000 });
  await desk.screenshot({ path: `${OUT}/voice-8-desktop-saved.png` });
});

await browser.close();
console.log(problems.length ? `\nProblems:\n${[...new Set(problems)].join('\n')}` : '\nNo console errors or failed requests.');
process.exit(failed ? 1 : 0);
