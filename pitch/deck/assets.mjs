// Renders the deck's Urdu lettering and stamps with the real Noto Nastaliq font (via Edge),
// as transparent PNGs. PowerPoint machines rarely have a Nastaliq font, so text becomes art.
//   node assets.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

mkdirSync('assets/art', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ deviceScaleFactor: 3 });

const FONT = `<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@600;700&family=Atkinson+Hyperlegible+Next:wght@700;800&display=block" rel="stylesheet">`;
const base = `*{margin:0;padding:0;box-sizing:border-box} body{background:transparent;display:inline-block}
.ur{font-family:'Noto Nastaliq Urdu',serif;direction:rtl}`;

async function render(name, css, html) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${base}${css}</style></head><body><div id="a">${html}</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.locator('#a').screenshot({ path: `assets/art/${name}.png`, omitBackground: true });
  console.log('rendered', name);
}

// The wordmark, painted in turmeric like signboard lettering.
await render('hisaab-haldi', '#a{padding:10px 30px 0 30px}', `<p class="ur" style="font-size:180px;line-height:1.9;color:#E8A317;font-weight:700">حساب</p>`);
await render('hisaab-white', '#a{padding:10px 30px 0 30px}', `<p class="ur" style="font-size:180px;line-height:1.9;color:#FFFFFF;font-weight:700">حساب</p>`);
// The tag line: "The shopkeeper speaks, Hisaab writes."
await render('tagline-urdu-haldi', '#a{padding:6px 16px}', `<p class="ur" style="font-size:64px;line-height:2.1;color:#F4C35F;font-weight:600">دکاندار بولتا ہے، حساب لکھتا ہے</p>`);
await render('tagline-urdu-ink', '#a{padding:6px 16px}', `<p class="ur" style="font-size:64px;line-height:2.1;color:#06301D;font-weight:600">دکاندار بولتا ہے، حساب لکھتا ہے</p>`);
// Stamps, as the app prints them on a saved entry.
const stamp = (word, line, color) => `
  <div style="display:inline-block;transform:rotate(-11deg);margin:36px 30px;border:7px solid ${color};border-radius:26px;padding:4px 34px 14px;text-align:center;background:rgba(255,253,246,0.92)">
    <p class="ur" style="font-size:88px;line-height:1.9;color:${color};font-weight:700">${word}</p>
    <p style="font-family:'Atkinson Hyperlegible Next',sans-serif;font-weight:800;font-size:30px;color:${color};margin-top:-14px">${line}</p>
  </div>`;
await render('stamp-udhaar', '', stamp('ادھار', 'Rs 5,000', '#C0392B'));
await render('stamp-wasool', '', stamp('وصول', 'Rs 2,000', '#0E6B3F'));
await browser.close();
