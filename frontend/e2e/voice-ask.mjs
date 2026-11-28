// "Bol kar poochein" (voice Phase C) in a real browser, with a recording played into a fake
// microphone: a spoken question is answered by the copilot from the shop's records, the
// number matches the khata, and nothing is written. Then a typed English question on desktop.
//
// It calls the online AI, so run it only against a scratch backend (see e2e/voice.mjs):
//   node e2e/voice-ask.mjs <recording.wav> e2e-shots
// The recording should ask about Imran's khata, e.g. "Imran ka kitna udhaar baqi hai?".
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:5180';
const WAV = resolve(process.argv[2] ?? 'ask-imran.wav');
const OUT = process.argv[3] ?? 'e2e-shots';
const SECONDS = Number(process.env.E2E_SPEAK_SECONDS ?? 5);
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
const money = (v) => `Rs ${Math.round(v).toLocaleString('en-US')}`;

const phone = await newPage({ width: 390, height: 844 }, 'roman_urdu');
let owed = '';
let entries = 0;
await step('ask by voice: answer from the khata', async () => {
  await phone.goto(`${BASE}/app`);
  await api(phone, '/api/voice/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cloud_allowed: true }) });
  const imran = (await api(phone, '/api/credit/customers?search=Imran'))[0];
  owed = money(imran.balance_pkr);
  entries = (await api(phone, `/api/credit/customers/${imran.customer_id}`)).total_entries;
  await phone.reload();
  await phone.locator('[data-tour="voice"]').click();
  await phone.getByRole('button', { name: 'Bas, samjho' }).waitFor({ timeout: 8000 });
  await phone.waitForTimeout(SECONDS * 1000);
  await phone.getByRole('button', { name: 'Bas, samjho' }).click();
  await phone.getByText('HisaabAI ka jawab').waitFor({ timeout: 60000 });
  await phone.getByText('Aap ne poocha').waitFor();
  const answer = await phone.getByRole('dialog').innerText();
  if (!answer.includes(owed)) throw new Error(`answer does not show ${owed}: ${answer.slice(0, 300)}`);
  if (await phone.getByRole('button', { name: 'Haan, likh do' }).count()) throw new Error('a question offered to write something');
  await phone.screenshot({ path: `${OUT}/ask-1-phone.png`, fullPage: true });
});
await step('nothing was written; closing is clean', async () => {
  await phone.getByRole('button', { name: 'Theek hai' }).click();
  const imran = (await api(phone, '/api/credit/customers?search=Imran'))[0];
  const after = (await api(phone, `/api/credit/customers/${imran.customer_id}`)).total_entries;
  if (after !== entries) throw new Error(`khata entries ${entries} -> ${after}`);
  const log = await api(phone, '/api/voice/log');
  if (log.captures[0].status !== 'answered') throw new Error(`last capture is ${log.captures[0].status}`);
});

const desk = await newPage({ width: 1366, height: 900 }, 'english');
await step('typed English question on desktop', async () => {
  await desk.goto(`${BASE}/app`);
  await desk.locator('[data-tour="voice-side"]').click();
  await desk.getByRole('button', { name: 'Or type it' }).click();
  await desk.locator('#voice-text').fill('How much does Imran owe?');
  await desk.getByRole('button', { name: 'Understand', exact: true }).click();
  await desk.getByText('HisaabAI says').waitFor({ timeout: 60000 });
  const answer = await desk.getByRole('dialog').innerText();
  if (!answer.includes(owed)) throw new Error(`answer does not show ${owed}`);
  await desk.getByText('“How much does Imran owe?”').waitFor();
  await desk.waitForTimeout(600);
  await desk.screenshot({ path: `${OUT}/ask-2-desktop.png` });
  await desk.getByRole('button', { name: 'Ask again' }).click();
  await desk.getByRole('button', { name: /Hold to speak|Stop and understand/ }).first().waitFor();
});

await step('follow-up continues in the chat', async () => {
  if (await desk.getByRole('button', { name: 'Or type it' }).count()) await desk.getByRole('button', { name: 'Or type it' }).click();
  await desk.locator('#voice-text').fill('How much does Imran owe?');
  await desk.getByRole('button', { name: 'Understand', exact: true }).click();
  await desk.getByRole('button', { name: 'Follow-up in chat' }).click({ timeout: 60000 });
  await desk.getByRole('dialog', { name: 'Say it, HisaabAI writes it' }).waitFor({ state: 'detached', timeout: 5000 });
  const chat = desk.getByRole('dialog', { name: 'Ask HisaabAI' });
  await chat.getByText('How much does Imran owe?').first().waitFor();
  if (!(await chat.innerText()).includes(owed)) throw new Error('the voice answer is not in the chat');
  await chat.locator('textarea, input[type="text"], input:not([type])').last().fill('Who owes me the most?');
  await desk.keyboard.press('Enter');
  await chat.getByText('Who owes me the most?').waitFor();
  await desk.waitForFunction(() => document.querySelectorAll('[role="dialog"] [data-role="assistant"], [role="dialog"] .assistant').length >= 0);
  await desk.waitForTimeout(500);
  await desk.screenshot({ path: `${OUT}/ask-3-chat.png` });
});

const today = await newPage({ width: 390, height: 844 }, 'roman_urdu');
await step('phone: one raised mic, no separate Ask button', async () => {
  await today.goto(`${BASE}/app`);
  await today.locator('[data-tour="voice"]').waitFor();
  if (await today.locator('[data-tour="ask"]').count()) throw new Error('the Ask pill is still there');
  await today.screenshot({ path: `${OUT}/ask-4-phone-bar.png` });
});

await browser.close();
console.log(problems.length ? `\nProblems:\n${[...new Set(problems)].join('\n')}` : '\nNo console errors or failed requests.');
process.exit(failed ? 1 : 0);
