// Builds pitch/HisaabAI_Pitch.pptx: the CYE 2026 Grand Finale deck.
//   node build.js && python animate.py
// build.js lays out the slides; animate.py adds PowerPoint transitions and build animations
// (pptxgenjs cannot write animations). Speaker notes carry the script from pitch.txt.
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const lu = require('react-icons/lu');
const { applyTheme } = require(path.join(
  process.env.USERPROFILE,
  '.claude/skills/synced/77fae53b-0c2d-4eee-b2c1-fdace5b4a21e_13d1a43e-2b9b-43c9-99fd-3f83c7e18aab/pptx/scripts/apply_theme.js',
));

const OUT = path.resolve(__dirname, '..', 'HisaabAI_Pitch.pptx');
const A = (p) => path.join(__dirname, 'assets', p);
const APP_ASSETS = path.resolve(__dirname, '..', '..', 'frontend', 'src', 'assets');

// ---- palette: the app's own (signboard green, turmeric, khata red, register ink, paper) ----
const K = {
  board: '06301D', board2: '084227', sabz: '0E6B3F', sabzLight: 'D7EDDF', sabz300: '82C29C', sabz100: 'D7EDDF',
  haldi: 'E8A317', haldiLight: 'FCEDCC', haldi300: 'F4C35F', haldiDark: '865606',
  lal: 'C0392B', lalLight: 'FADDD9', lalDark: 'A02E22',
  neela: '2A5BA8', neelaLight: 'DCE6F6', neelaDark: '22488A',
  paper: 'FAF5EC', card: 'FFFFFF', ink: '1B1915', muted: '595349', faint: '7A7265', line: 'E4DAC6',
};
const THEME = {
  name: 'HisaabAI Signboard',
  headFontFace: 'Bookman Old Style',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: K.ink, lt1: 'FFFFFF', dk2: K.board, lt2: K.paper,
    accent1: K.sabz, accent2: K.haldi, accent3: K.lal, accent4: K.neela, accent5: K.board2, accent6: K.muted,
    hlink: K.neela, folHlink: K.neelaDark,
  },
};
const HEAD = 'Bookman Old Style';
const BODY = 'Calibri';

// Animation plan, read by animate.py: slide number -> [{name, effect, trigger, delay}]
const ANIM = {};
let slideNo = 0;
function anim(name, effect = 'fade', trigger = 'after', delay = 0) {
  (ANIM[slideNo] = ANIM[slideNo] || []).push({ name, effect, trigger, delay });
  return name;
}

async function icon(name, color, px = 256) {
  const svg = renderToStaticMarkup(React.createElement(lu[name], { size: px, color: `#${color}`, strokeWidth: 2 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
const shadow = () => ({ type: 'outer', color: '06301D', blur: 14, offset: 4, angle: 90, opacity: 0.18 });

async function main() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
  pres.title = 'HisaabAI: Grand Finale pitch';
  pres.subject = 'CYE 2026, Track 3: FinTech and Financial Inclusion';
  pres.author = 'HisaabAI team';
  pres.company = 'HisaabAI';
  pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

  // ---- layouts ---------------------------------------------------------------------------
  const frame = () => ({ rect: { x: 0.3, y: 0.3, w: 12.733, h: 6.9, fill: { type: 'none' }, line: { color: K.haldi, width: 2.25 }, rectRadius: 0.22 } });
  pres.defineSlideMaster({
    title: 'BOARD',
    background: { color: K.board },
    objects: [{ roundRect: { x: 0.3, y: 0.3, w: 12.733, h: 6.9, fill: { type: 'none' }, line: { color: K.haldi, width: 2.25 }, rectRadius: 0.22 } }],
  });
  pres.defineSlideMaster({
    title: 'BOARD_TITLED',
    background: { color: K.board },
    objects: [
      { roundRect: { x: 0.3, y: 0.3, w: 12.733, h: 6.9, fill: { type: 'none' }, line: { color: K.haldi, width: 2.25 }, rectRadius: 0.22 } },
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 0.62, w: 11.7, h: 0.9, fontFace: HEAD, fontSize: 36, bold: true, color: 'FFFFFF', valign: 'top', margin: 0 }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'PAPER',
    background: { color: K.paper },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.45, w: 12.1, h: 0.85, fontFace: HEAD, fontSize: 36, bold: true, color: K.board, valign: 'top', margin: 0 }, text: '' } },
      { text: { text: 'HisaabAI', options: { x: 0.6, y: 7.02, w: 3, h: 0.3, fontFace: BODY, fontSize: 10, color: K.faint, margin: 0 } } },
    ],
    slideNumber: { x: 12.23, y: 7.02, w: 0.5, h: 0.3, fontFace: BODY, fontSize: 10, color: K.faint, align: 'right' },
  });
  pres.defineSlideMaster({ title: 'PHOTO', background: { color: K.board } });

  // The signboard's painted turmeric border, drawn on each dark slide.
  const boardFrame = (slide) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.3, y: 0.3, w: 12.733, h: 6.9, fill: { type: 'none' }, line: { color: K.haldi, width: 2.25 }, rectRadius: 0.22, objectName: 'board-frame' });

  // A phone: dark rounded frame with the real screen inside. Returns the names for animation.
  function phone(slide, file, x, y, h, name) {
    const w = (h - 0.16) * (390 / 844) + 0.16;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: K.ink }, line: { color: K.ink, width: 0.5 }, rectRadius: 0.24, shadow: shadow(), objectName: `${name}-frame` });
    slide.addImage({ path: A(`shots/${file}`), x: x + 0.08, y: y + 0.08, w: w - 0.16, h: h - 0.16, objectName: `${name}-screen`, altText: `HisaabAI app screen: ${file.replace('.png', '')}` });
    return { w, names: [`${name}-frame`, `${name}-screen`] };
  }

  // =========================================================================================
  // 1. HOOK: the khata counter, the word حساب
  // =========================================================================================
  pres.addSection({ title: 'Pitch' });
  let s = pres.addSlide({ masterName: 'PHOTO', sectionTitle: 'Pitch' });
  slideNo = 1;
  s.addImage({ path: path.join(APP_ASSETS, 'khata-counter.jpg'), x: 0, y: 0, w: 13.333, h: 7.5, objectName: 'photo', altText: 'A karyana shop counter with the red khata register and the cash drawer' });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: K.board, transparency: 22 }, line: { type: 'none' }, objectName: 'veil' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.3, y: 0.3, w: 12.733, h: 6.9, fill: { type: 'none' }, line: { color: K.haldi, width: 2.25 }, rectRadius: 0.22, objectName: 'board-frame' });
  s.addImage({ path: A('art/hisaab-haldi.png'), x: 4.42, y: 0.55, w: 4.5, h: 2.94, objectName: anim('hisaab', 'fade', 'after', 300), altText: 'حساب (Hisaab)' });
  s.addText('HisaabAI', { x: 2.5, y: 3.55, w: 8.333, h: 0.9, fontFace: HEAD, fontSize: 48, bold: true, color: 'FFFFFF', align: 'center', margin: 0, isTextBox: true, objectName: anim('name', 'fade', 'after', 200) });
  s.addImage({ path: A('art/tagline-urdu-haldi.png'), x: 3.67, y: 4.6, w: 6.0, h: 1.1, objectName: anim('tag-ur', 'fade', 'after', 400), altText: 'دکاندار بولتا ہے، حساب لکھتا ہے' });
  s.addText('Dukaandar bolta hai. HisaabAI likhta hai.', { x: 2.5, y: 5.72, w: 8.333, h: 0.5, fontFace: BODY, fontSize: 22, italic: true, color: K.haldiLight, align: 'center', margin: 0, isTextBox: true, objectName: anim('tag-en', 'fade', 'with', 0) });
  s.addText('Capital Youth Expo 2026   |   Track 3: FinTech and Financial Inclusion', { x: 2.5, y: 6.55, w: 8.333, h: 0.35, fontFace: BODY, fontSize: 14, color: K.sabz100, align: 'center', margin: 0, isTextBox: true, objectName: anim('event', 'fade', 'after', 200) });
  s.addNotes(`HOOK (0:00-0:30). Look at the jury, not the screen. Speak slowly.

"Haji Akram runs a general store in G-9 Markaz.
Every night he opens this. (point to the red khata register)
Who took udhaar, what the distributor brought, what's left in the galla. All by hand.
The register tells him what happened. It never tells him what to do tomorrow.
So we built a shop where he just speaks..."
(beat) "Dukaandar bolta hai. HisaabAI likhta hai."

The lettering builds by itself after the slide opens. Click once to go on.`);

  // =========================================================================================
  // 2. MARKET: a million shops, almost all on paper
  // =========================================================================================
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'Pitch' });
  slideNo = 2;
  s.addText('A million shops still run on paper', { placeholder: 'title' });
  s.addText('~1 million', { x: 0.6, y: 1.95, w: 6.4, h: 1.2, fontFace: HEAD, fontSize: 66, bold: true, color: K.board, margin: 0, isTextBox: true, objectName: anim('big', 'fade', 'after', 200) });
  s.addText('karyana stores across Pakistan. Each one runs its stock, its khata and its cash box from a paper register.', { x: 0.6, y: 3.3, w: 5.8, h: 1.2, fontFace: BODY, fontSize: 20, color: K.muted, margin: 0, isTextBox: true, valign: 'top', objectName: anim('big-sub', 'fade', 'with', 150) });
  s.addText('Source: Karandaaz, Micro-Retailer Financing.', { x: 0.6, y: 4.6, w: 5.6, h: 0.35, fontFace: BODY, fontSize: 11, color: K.faint, margin: 0, isTextBox: true, objectName: anim('src1', 'fade', 'with', 150) });
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'Retailers', labels: ['Use a POS machine', 'Do not'], values: [151, 4849] }], {
    x: 7.75, y: 1.5, w: 4.2, h: 4.2, holeSize: 72, chartColors: [K.haldi, K.line], showLegend: false, showValue: false, showPercent: false,
    showLabel: false, dataBorder: { pt: 0, color: K.paper }, objectName: anim('donut', 'wipe', 'after', 300),
  });
  s.addText([{ text: '3%', options: { fontFace: HEAD, fontSize: 54, bold: true, color: K.haldiDark, breakLine: true } }, { text: 'use a POS', options: { fontFace: BODY, fontSize: 16, color: K.muted } }], { x: 8.35, y: 2.8, w: 3.0, h: 1.6, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: anim('donut-c', 'fade', 'with', 300) });
  s.addText('Only about 151,000 of more than 5 million retailers have a POS machine. Typing tools have not reached the counter.', { x: 7.05, y: 5.8, w: 5.6, h: 0.6, fontFace: BODY, fontSize: 14, color: K.muted, align: 'center', margin: 0, isTextBox: true, objectName: anim('donut-t', 'fade', 'with', 300) });
  s.addText('Source: State Bank of Pakistan data, reported by ProPakistani (2025).', { x: 7.05, y: 6.45, w: 5.6, h: 0.3, fontFace: BODY, fontSize: 10, color: K.faint, align: 'center', margin: 0, isTextBox: true });
  s.addNotes(`PROBLEM, part 1 (0:30-0:40).

"Pakistan has about a million karyana stores, almost all on paper."

The number and the chart build by themselves. Move on quickly: the next slide is the problem itself.`);

  // =========================================================================================
  // 3. PROBLEM: three money leaks (one per click)
  // =========================================================================================
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'Pitch' });
  slideNo = 3;
  s.addText('Every shop leaks money in three places', { placeholder: 'title' });
  const leaks = [
    { icon: 'LuPackageX', head: 'The fast seller runs out', big: '2.6 days', bigLine: 'of Dalda oil left. A new order takes 4 days to come.', tail: 'The customer walks to the next shop.' },
    { icon: 'LuTrendingDown', head: 'The rate goes up quietly', big: '9.2% → 3.3%', bigLine: 'Tapal margin after the distributor added Rs 45 a pouch.', tail: 'The shelf price never moved.' },
    { icon: 'LuBookOpenText', head: 'Udhaar comes back late', big: '76 days', bigLine: 'Tariq Bhai: Rs 30,696 overdue, his oldest bill unpaid.', tail: 'Nobody reminded him in time.' },
  ];
  for (let i = 0; i < 3; i++) {
    const L = leaks[i];
    const x = 0.6 + i * 4.1;
    const n = `leak${i + 1}`;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 3.85, h: 4.35, fill: { color: K.card }, line: { color: K.line, width: 0.75 }, rectRadius: 0.18, shadow: shadow(), objectName: anim(`${n}-card`, 'fade', i === 0 ? 'click' : 'click', 0) });
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 1.95, w: 0.8, h: 0.8, fill: { color: K.lalLight }, line: { type: 'none' }, objectName: anim(`${n}-dot`, 'fade', 'with', 0) });
    s.addImage({ data: await icon(L.icon, K.lal), x: x + 0.52, y: 2.12, w: 0.46, h: 0.46, objectName: anim(`${n}-icon`, 'fade', 'with', 0), altText: L.head });
    s.addText(L.head, { x: x + 0.35, y: 2.92, w: 3.25, h: 0.8, fontFace: HEAD, fontSize: 19, valign: 'top', bold: true, color: K.ink, margin: 0, isTextBox: true, objectName: anim(`${n}-head`, 'fade', 'with', 0) });
    s.addText(L.big, { x: x + 0.35, y: 3.8, w: 3.3, h: 0.65, fontFace: HEAD, fontSize: 30, bold: true, color: K.lal, margin: 0, isTextBox: true, objectName: anim(`${n}-big`, 'fade', 'with', 150) });
    s.addText(L.bigLine, { x: x + 0.35, y: 4.5, w: 3.2, h: 0.75, fontFace: BODY, fontSize: 15, color: K.muted, margin: 0, isTextBox: true, valign: 'top', objectName: anim(`${n}-line`, 'fade', 'with', 150) });
    s.addText(L.tail, { x: x + 0.35, y: 5.32, w: 3.2, h: 0.5, fontFace: BODY, fontSize: 15, bold: true, color: K.ink, margin: 0, isTextBox: true, objectName: anim(`${n}-tail`, 'fade', 'with', 250) });
  }
  s.addText('Today’s tools are built for typing. A shopkeeper with a queue at the counter does not type.', { x: 0.6, y: 6.18, w: 12.1, h: 0.5, fontFace: BODY, fontSize: 20, italic: true, color: K.board, margin: 0, isTextBox: true, objectName: anim('punch', 'fade', 'click', 0) });
  s.addText('Figures from the demo shop in the app.', { x: 9.0, y: 7.02, w: 3.1, h: 0.3, fontFace: BODY, fontSize: 10, color: K.faint, align: 'right', margin: 0, isTextBox: true });
  s.addNotes(`PROBLEM, part 2 (0:40-1:00). FOUR CLICKS on this slide: one per leak, one for the last line.

"Each one leaks money in the same three places."
(click) "The fast seller runs out, and the customer walks to the next shop."
(click) "The distributor raises the rate, the shelf price doesn't move, and the margin disappears."
(click) "And udhaar comes back late, or never."
(click) "Today's tools are built for typing. A shopkeeper with a queue at the counter does not type."

Optional, if you have one: a real shopkeeper's quote here beats any number.`);

  // =========================================================================================
  // 4. SOLUTION: speak it, check it, it's in the books
  // =========================================================================================
  s = pres.addSlide({ masterName: 'BOARD_TITLED', sectionTitle: 'Pitch' });
  slideNo = 4;
  boardFrame(s);
  s.addText('A munshi in the shopkeeper’s pocket', { placeholder: 'title' });
  const steps = [
    { icon: 'LuMic', head: 'Speak it', line: 'In Urdu, Punjabi or English, the way he already talks at the counter.' },
    { icon: 'LuScanSearch', head: 'Check it', line: 'He sees what was heard, in Urdu and Roman Urdu, before anything is written.' },
    { icon: 'LuBookOpenText', head: 'It’s in the books', line: 'Khata, cash box and stock update together. Every morning: three jobs, with the reason.' },
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.95 + i * 1.45;
    const n = `step${i + 1}`;
    s.addShape(pres.shapes.OVAL, { x: 0.85, y, w: 0.95, h: 0.95, fill: { color: K.haldi }, line: { type: 'none' }, objectName: anim(`${n}-dot`, 'fade', 'after', i === 0 ? 300 : 250) });
    s.addImage({ data: await icon(steps[i].icon, K.board), x: 1.07, y: y + 0.22, w: 0.51, h: 0.51, objectName: anim(`${n}-icon`, 'fade', 'with', 0), altText: steps[i].head });
    s.addText(steps[i].head, { x: 2.1, y: y - 0.02, w: 4.7, h: 0.5, fontFace: HEAD, fontSize: 24, bold: true, color: 'FFFFFF', margin: 0, isTextBox: true, objectName: anim(`${n}-head`, 'fade', 'with', 0) });
    s.addText(steps[i].line, { x: 2.1, y: y + 0.5, w: 4.7, h: 0.8, fontFace: BODY, fontSize: 16, color: K.sabz100, margin: 0, valign: 'top', isTextBox: true, objectName: anim(`${n}-line`, 'fade', 'with', 100) });
  }
  // The card he sees, and the stamp when it is written.
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.35, y: 1.75, w: 5.1, h: 4.45, fill: { color: 'FFFFFF' }, line: { color: K.haldi, width: 1.5 }, rectRadius: 0.2, shadow: shadow(), objectName: anim('card-bg', 'fade', 'after', 300) });
  s.addImage({ path: A('art/voice-card.png'), x: 7.6, y: 1.95, w: 4.6, h: 3.96, objectName: anim('card', 'fade', 'with', 0), altText: 'The confirmation card: Ali Butt took Rs 5,000 cash on udhaar, for his daughter’s school fees' });
  s.addText('“Aaj Ali Butt mujh se paanch hazaar rupay udhaar le kar gaya, beti ki fees ke liye.”', { x: 7.35, y: 6.3, w: 5.1, h: 0.7, fontFace: BODY, fontSize: 14, italic: true, color: K.haldiLight, align: 'center', margin: 0, isTextBox: true, objectName: anim('said', 'fade', 'with', 200) });
  s.addImage({ path: A('art/stamp-udhaar.png'), x: 10.75, y: 0.95, w: 2.05, h: 1.9, objectName: anim('stamp', 'zoom', 'after', 500), altText: 'Stamp: ادھار Rs 5,000' });
  s.addNotes(`SOLUTION (1:00-1:20).

"HisaabAI is a munshi in the shopkeeper's pocket.
He speaks in Urdu, the way he talks, and it writes the khata, the cash book and the stock.
Every morning it gives him three jobs, with the reason and the numbers.
Let me show you. Live."

The three steps, the card and the stamp build by themselves. Then switch to the live app.`);

  // =========================================================================================
  // 5. LIVE DEMO: four moments (also the backup if the live demo fails)
  // =========================================================================================
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'Pitch' });
  slideNo = 5;
  s.addText('Live: four things he does by speaking', { placeholder: 'title' });
  const moments = [
    { file: 'voice-saved.png', said: '“Ali Butt paanch hazaar udhaar le gaya”', result: 'Written in the khata. The cash box is Rs 5,000 lighter.' },
    { file: 'goods-items.png', said: '“Do kilo cheeni aur teen Lux sabun”', result: 'Matched to his shelf, at his own prices. Stock goes down.' },
    { file: 'ask-answer.png', said: '“Imran ka kitna udhaar baqi hai?”', result: 'Answered from his own khata, read aloud in Urdu.' },
    { file: 'jobs.png', said: 'Every morning, three jobs', result: 'And Rs 50,000 becomes an order, never over budget.' },
  ];
  for (let i = 0; i < 4; i++) {
    const slotX = 0.6 + i * 3.075;
    const ph = 4.15;
    const pw = (ph - 0.16) * (390 / 844) + 0.16;
    const px = slotX + (2.85 - pw) / 2;
    const { names } = phone(s, moments[i].file, px, 1.45, ph, `ph${i + 1}`);
    anim(names[0], 'fade', 'after', i === 0 ? 250 : 200);
    anim(names[1], 'fade', 'with', 0);
    s.addShape(pres.shapes.OVAL, { x: slotX + 0.02, y: 5.72, w: 0.42, h: 0.42, fill: { color: K.sabz }, line: { type: 'none' }, objectName: anim(`m${i + 1}-n`, 'fade', 'with', 0) });
    s.addText(String(i + 1), { x: slotX + 0.02, y: 5.72, w: 0.42, h: 0.42, fontFace: HEAD, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: anim(`m${i + 1}-nt`, 'fade', 'with', 0) });
    s.addText([
      { text: moments[i].said, options: { fontFace: BODY, fontSize: 14, bold: true, italic: true, color: K.ink, breakLine: true } },
      { text: moments[i].result, options: { fontFace: BODY, fontSize: 13, color: K.muted } },
    ], { x: slotX + 0.55, y: 5.66, w: 2.35, h: 1.25, valign: 'top', margin: 0, isTextBox: true, objectName: anim(`m${i + 1}-t`, 'fade', 'with', 100) });
  }
  s.addNotes(`LIVE DEMO (1:20-3:10). Switch to the live app now. This slide is the backup: if the network or mic fails, talk over it.

Moment 1 (DRIVER speaks): "Aaj Ali Butt mujh se paanch hazaar rupay udhaar le kar gaya, beti ki fees ke liye."
  "No typing. No forms." ... "The person, the amount, cash from the galla, even the reason. And he checks it first.
  Ali Butt is new, so it opens a new khata. It doesn't guess he's Imran Butt."
  Tap "Haan, likh do". "Written. And the cash box is five thousand lighter, automatically."

Moment 2 (DRIVER): "Imran do kilo cheeni aur teen Lux sabun le gaya."
  "Goods too. 'Cheeni' is the sugar on his shelf, two kilos, three Lux soaps, at his own shelf price. The stock goes down by itself."

Moment 3 (DRIVER): "Imran ka kitna udhaar baqi hai?"
  "Or just ask. The answer comes from his own khata, read aloud in Urdu."

Moment 4: Aaj -> the three jobs, then Order -> "Whole shop, one budget".
  "Every morning, three jobs. Dalda runs out in three days. Tapal's rate went up but the shelf price didn't: fix it.
  Tariq Bhai is seventy-six days late: here's a polite reminder."
  "And 'I have fifty thousand, what do I buy?' Whole cartons, most urgent first, never one rupee over budget.
  One tap, and it's an order for each distributor."

If the Wi-Fi fails: "The hall Wi-Fi is busy, so I'll type it. Same engine." Typed Roman Urdu works offline.`);

  // =========================================================================================
  // 6. TRUST: the pipeline that keeps the AI honest
  // =========================================================================================
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'Pitch' });
  slideNo = 6;
  s.addText('Built so the AI can’t invent money', { placeholder: 'title' });
  const nodes = [
    { icon: 'LuEar', head: 'Heard', color: K.neela, light: K.neelaLight },
    { icon: 'LuSparkles', head: 'Understood', color: K.neela, light: K.neelaLight },
    { icon: 'LuShieldCheck', head: 'Checked', color: K.haldiDark, light: K.haldiLight },
    { icon: 'LuCircleCheckBig', head: 'Confirmed', color: K.sabz, light: K.sabzLight },
    { icon: 'LuBookOpenText', head: 'Written', color: K.sabz, light: K.sabzLight },
  ];
  const rules = [
    'Speech in Urdu, Punjabi or English.',
    'Gemini first, then Groq, then offline rules. Never stuck.',
    'An amount is kept only if it was said. Prices come from his shelf.',
    'Nothing is saved until he says “Haan, likh do”.',
    'Khata, cash box and stock in one step. The recording is kept as proof.',
  ];
  for (let i = 0; i < 5; i++) {
    const cx = 0.6 + i * 2.46;
    const n = `node${i + 1}`;
    s.addShape(pres.shapes.OVAL, { x: cx + 0.62, y: 1.65, w: 1.1, h: 1.1, fill: { color: nodes[i].light }, line: { color: nodes[i].color, width: 2 }, objectName: anim(`${n}-dot`, 'fade', 'after', i === 0 ? 300 : 0) });
    s.addImage({ data: await icon(nodes[i].icon, nodes[i].color), x: cx + 0.9, y: 1.93, w: 0.54, h: 0.54, objectName: anim(`${n}-icon`, 'fade', 'with', 0), altText: nodes[i].head });
    s.addText(nodes[i].head, { x: cx, y: 2.92, w: 2.34, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: K.ink, align: 'center', margin: 0, isTextBox: true, objectName: anim(`${n}-head`, 'fade', 'with', 0) });
    s.addText(rules[i], { x: cx + 0.12, y: 3.42, w: 2.1, h: 1.35, fontFace: BODY, fontSize: 14, color: K.muted, align: 'center', valign: 'top', margin: 0, isTextBox: true, objectName: anim(`${n}-rule`, 'fade', 'with', 120) });
    if (i < 4) {
      s.addShape(pres.shapes.LINE, { x: cx + 1.82, y: 2.2, w: 1.26, h: 0, line: { color: K.faint, width: 2, endArrowType: 'triangle' }, objectName: anim(`arrow${i + 1}`, 'wipe', 'after', 0) });
    }
  }
  // Proof that it is built, not mocked.
  const proofs = [
    { big: '205', small: 'automated tests on the money rules', color: K.sabz },
    { big: '5', small: 'end-to-end walkthroughs in a real browser', color: K.neela },
    { big: 'Offline', small: 'typed Urdu still works without internet', color: K.haldiDark },
  ];
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.05, w: 12.1, h: 1.6, fill: { color: K.card }, line: { color: K.line, width: 0.75 }, rectRadius: 0.16, objectName: anim('proof-bg', 'fade', 'after', 300) });
  for (let i = 0; i < 3; i++) {
    const x = 0.95 + i * 4.0;
    s.addText(proofs[i].big, { x, y: 5.25, w: 3.6, h: 0.7, fontFace: HEAD, fontSize: 32, bold: true, color: proofs[i].color, margin: 0, isTextBox: true, objectName: anim(`proof${i + 1}-b`, 'fade', 'with', i * 150) });
    s.addText(proofs[i].small, { x, y: 5.95, w: 3.6, h: 0.55, fontFace: BODY, fontSize: 15, color: K.muted, margin: 0, isTextBox: true, valign: 'top', objectName: anim(`proof${i + 1}-s`, 'fade', 'with', i * 150) });
  }
  s.addNotes(`TRUST (3:10-3:35). The diagram draws itself left to right.

"With money, trust beats magic. So the engine has rules.
Nothing is written until he says 'haan'.
If the AI says fifty thousand but he said 'paanch hazaar', we throw the AI's number away.
Prices and balances come from his books, never from the AI.
And if a customer says 'maine itna nahi liya', he plays back the recording."

If asked: 205 backend tests pass; the 5 walkthroughs run the real app in Edge with a recorded voice played into the microphone.`);

  // =========================================================================================
  // 7. IMPACT: records become a credit history
  // =========================================================================================
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'Pitch' });
  slideNo = 7;
  s.addText('Daily records become a credit history', { placeholder: 'title' });
  const flow = [
    { icon: 'LuBookOpenText', head: 'Paper khata', line: 'Invisible to any bank', color: K.lal, light: K.lalLight },
    { icon: 'LuMic', head: 'Voice records', line: 'Every udhaar, wasooli and cash count', color: K.sabz, light: K.sabzLight },
    { icon: 'LuFileText', head: 'Business report', line: 'One tap, in English, for lenders', color: K.haldiDark, light: K.haldiLight },
    { icon: 'LuLandmark', head: 'Microfinance', line: 'Can finally see the shop, and lend', color: K.neela, light: K.neelaLight },
  ];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 3.1;
    const n = `flow${i + 1}`;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.55, w: 2.75, h: 1.55, fill: { color: flow[i].light }, line: { color: flow[i].color, width: 1.5 }, rectRadius: 0.16, objectName: anim(`${n}-box`, 'fade', 'after', i === 0 ? 300 : 0) });
    s.addImage({ data: await icon(flow[i].icon, flow[i].color), x: x + 0.25, y: 1.78, w: 0.45, h: 0.45, objectName: anim(`${n}-icon`, 'fade', 'with', 0), altText: flow[i].head });
    s.addText(flow[i].head, { x: x + 0.82, y: 1.75, w: 1.85, h: 0.5, fontFace: HEAD, fontSize: 16, bold: true, color: K.ink, valign: 'middle', margin: 0, isTextBox: true, objectName: anim(`${n}-head`, 'fade', 'with', 0) });
    s.addText(flow[i].line, { x: x + 0.25, y: 2.35, w: 2.3, h: 0.65, fontFace: BODY, fontSize: 14, color: K.muted, valign: 'top', margin: 0, isTextBox: true, objectName: anim(`${n}-line`, 'fade', 'with', 0) });
    if (i < 3) {
      s.addShape(pres.shapes.LINE, { x: x + 2.8, y: 2.32, w: 0.25, h: 0, line: { color: K.faint, width: 2, endArrowType: 'triangle' }, objectName: anim(`farrow${i + 1}`, 'wipe', 'after', 0) });
    }
  }
  // The real report, as a lender would see it.
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 3.45, w: 5.15, h: 3.45, fill: { color: K.card }, line: { color: K.line, width: 0.75 }, rectRadius: 0.12, shadow: shadow(), objectName: anim('report-bg', 'fade', 'after', 300) });
  s.addImage({ path: A('shots/report.png'), x: 0.72, y: 3.57, w: 4.91, h: 3.21, sizing: { type: 'cover', w: 4.91, h: 3.21 }, objectName: anim('report', 'fade', 'with', 0), altText: 'The business report for a loan: monthly sales, profit and margin from the shop’s own records' });
  s.addText('Why Track 3', { x: 6.25, y: 3.55, w: 6.4, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: K.board, margin: 0, isTextBox: true, objectName: anim('why-h', 'fade', 'after', 200) });
  s.addText('A karyana store can’t get a loan because on paper it has no history. Voice gets the data in. The three jobs keep him coming back. The history opens credit.', { x: 6.25, y: 4.1, w: 6.4, h: 1.25, fontFace: BODY, fontSize: 17, color: K.muted, margin: 0, valign: 'top', isTextBox: true, objectName: anim('why-t', 'fade', 'with', 0) });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.25, y: 5.55, w: 6.45, h: 1.35, fill: { color: K.board }, line: { type: 'none' }, rectRadius: 0.16, objectName: anim('model-bg', 'fade', 'after', 300) });
  s.addImage({ data: await icon('LuHandCoins', K.haldi), x: 6.5, y: 5.83, w: 0.6, h: 0.6, objectName: anim('model-icon', 'fade', 'with', 0), altText: 'Business model' });
  s.addText([
    { text: 'Free for the shopkeeper.', options: { bold: true, color: 'FFFFFF', breakLine: true } },
    { text: 'With his consent, lenders pay us per loan they make.', options: { color: K.sabz100 } },
  ], { x: 7.3, y: 5.65, w: 5.2, h: 1.15, fontFace: BODY, fontSize: 17, valign: 'middle', margin: 0, isTextBox: true, objectName: anim('model-t', 'fade', 'with', 0) });
  s.addNotes(`IMPACT + BUSINESS (3:35-4:15). The flow draws itself, then the report and the model.

"Why financial inclusion? A karyana store can't get a loan because on paper it has no history.
Every udhaar, wasooli and galla count in HisaabAI builds that history,
and one tap prints a business report a lender can read.
Voice gets the data in. The three jobs keep him coming back. The history opens credit."

Business model (one sentence): "Free for the shopkeeper. With his consent, the same records let microfinance banks lend to shops they could never see before; they pay us per loan."
[If your team picks a different model, change the dark box on this slide.]`);

  // =========================================================================================
  // 8. THE ASK
  // =========================================================================================
  s = pres.addSlide({ masterName: 'BOARD', sectionTitle: 'Pitch' });
  slideNo = 8;
  boardFrame(s);
  s.addText('Our ask', { x: 0.8, y: 0.62, w: 11.7, h: 0.9, fontFace: HEAD, fontSize: 40, bold: true, color: 'FFFFFF', margin: 0, isTextBox: true, objectName: anim('ask-h', 'fade', 'after', 200) });
  const asks = [
    { icon: 'LuStore', big: '5 shops, 30 days', line: 'A real pilot in Islamabad: their own records, by voice and from their sales files.' },
    { icon: 'LuHandshake', big: '1 microfinance partner', line: 'An introduction, to turn a shop’s records into its first loan.' },
  ];
  for (let i = 0; i < 2; i++) {
    const x = 0.8 + i * 6.0;
    const n = `ask${i + 1}`;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 5.7, h: 2.55, fill: { color: K.board2 }, line: { color: K.haldi, width: 1.25 }, rectRadius: 0.2, objectName: anim(`${n}-box`, 'fade', 'after', i === 0 ? 300 : 250) });
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 2.05, w: 0.85, h: 0.85, fill: { color: K.haldi }, line: { type: 'none' }, objectName: anim(`${n}-dot`, 'fade', 'with', 0) });
    s.addImage({ data: await icon(asks[i].icon, K.board), x: x + 0.55, y: 2.25, w: 0.45, h: 0.45, objectName: anim(`${n}-icon`, 'fade', 'with', 0), altText: asks[i].big });
    s.addText(asks[i].big, { x: x + 1.4, y: 2.05, w: 4.1, h: 0.85, fontFace: HEAD, fontSize: 28, bold: true, color: K.haldi300, valign: 'middle', margin: 0, isTextBox: true, objectName: anim(`${n}-big`, 'fade', 'with', 0) });
    s.addText(asks[i].line, { x: x + 0.35, y: 3.1, w: 5.0, h: 1.0, fontFace: BODY, fontSize: 18, color: K.sabz100, valign: 'top', margin: 0, isTextBox: true, objectName: anim(`${n}-line`, 'fade', 'with', 100) });
  }
  s.addText('Today it runs on a simulated shop, and it says so on every screen. The pilot makes it real.', { x: 0.8, y: 4.5, w: 11.7, h: 0.45, fontFace: BODY, fontSize: 16, italic: true, color: K.sabz300, margin: 0, isTextBox: true, objectName: anim('honest', 'fade', 'after', 200) });
  s.addImage({ path: A('art/tagline-urdu-haldi.png'), x: 3.67, y: 5.05, w: 6.0, h: 1.1, objectName: anim('close-ur', 'fade', 'after', 400), altText: 'دکاندار بولتا ہے، حساب لکھتا ہے' });
  s.addText('Dukaandar bolta hai. HisaabAI likhta hai.', { x: 2.5, y: 6.12, w: 8.333, h: 0.45, fontFace: BODY, fontSize: 20, italic: true, color: K.haldiLight, align: 'center', margin: 0, isTextBox: true, objectName: anim('close-en', 'fade', 'with', 0) });
  s.addText('[Team names, university]', { x: 2.5, y: 6.62, w: 8.333, h: 0.35, fontFace: BODY, fontSize: 13, color: K.sabz300, align: 'center', margin: 0, isTextBox: true, objectName: anim('team', 'fade', 'with', 200) });
  s.addNotes(`THE ASK + CLOSE (4:15-4:30).

"Today it runs on a simulated shop, and we say so on every screen.
Our ask: five real shops in Islamabad for a thirty-day pilot,
and one introduction to a microfinance partner.
[Team names, one line: 'We are ..., students at ...']
Dukaandar bolta hai. HisaabAI likhta hai. Shukriya."

Stop. Smile. Don't add anything. Replace "[Team names, university]" on the slide before Dec 2.`);

  // =========================================================================================
  // APPENDIX (for Q&A)
  // =========================================================================================
  pres.addSection({ title: 'For questions' });

  // A1. Architecture
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'For questions' });
  slideNo = 9;
  s.addText('The AI understands. The books decide.', { placeholder: 'title' });
  const col = (x, y, w, h, fill, line, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: line, width: 1.25 }, rectRadius: 0.14, objectName: name });
  const label = (text, x, y, w, h, opts = {}) => s.addText(text, { x, y, w, h, fontFace: BODY, fontSize: 14, color: K.ink, margin: 0.06, valign: 'middle', isTextBox: true, ...opts });
  // Phone / app
  col(0.6, 1.6, 2.7, 4.9, K.card, K.line, 'arch-app');
  s.addImage({ data: await icon('LuSmartphone', K.sabz), x: 1.65, y: 1.85, w: 0.6, h: 0.6, altText: 'Phone' });
  label('Phone or laptop', 0.7, 2.55, 2.5, 0.45, { fontFace: HEAD, fontSize: 16, bold: true, align: 'center' });
  label('React app in the browser. Mic, review card, Urdu read-aloud, recordings.', 0.8, 3.05, 2.3, 1.6, { align: 'center', color: K.muted, valign: 'top' });
  label('Runs in any phone browser, no app store', 0.8, 5.6, 2.3, 0.7, { align: 'center', fontSize: 13, color: K.sabz, bold: true });
  // Backend
  col(3.85, 1.6, 4.6, 4.9, K.sabzLight, K.sabz, 'arch-api');
  label('Shop engine (FastAPI)', 4.0, 1.75, 4.3, 0.45, { fontFace: HEAD, fontSize: 16, bold: true });
  const svc = ['Khata, wasooli and cash book', 'Orders, Maal aaya and stock', 'Forecast and the Rs 50,000 plan', 'Today’s 3 jobs and the loan report'];
  for (let i = 0; i < 4; i++) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.05, y: 2.3 + i * 0.78, w: 4.2, h: 0.62, fill: { color: K.card }, line: { color: K.sabz300, width: 0.75 }, rectRadius: 0.1 });
    label(svc[i], 4.15, 2.3 + i * 0.78, 4.0, 0.62);
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.05, y: 5.5, w: 4.2, h: 0.8, fill: { color: K.board }, line: { type: 'none' }, rectRadius: 0.1 });
  label('Shop records (SQLite). Only these services write to them, after the shopkeeper confirms.', 4.15, 5.5, 4.0, 0.8, { color: 'FFFFFF', fontSize: 13 });
  // AI layer
  col(9.0, 1.6, 3.7, 4.9, K.neelaLight, K.neela, 'arch-ai');
  label('AI layer (never writes)', 9.15, 1.75, 3.4, 0.45, { fontFace: HEAD, fontSize: 16, bold: true });
  const tiers = ['1. Gemini: hears the audio, fills a fixed form', '2. Groq Whisper: if Gemini is busy', '3. Offline rules: typed Urdu, no internet', 'Copilot: read-only tools, numbers only from data'];
  for (let i = 0; i < 4; i++) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.2, y: 2.3 + i * 0.98, w: 3.3, h: 0.82, fill: { color: K.card }, line: { color: K.neela, width: 0.75 }, rectRadius: 0.1 });
    label(tiers[i], 9.28, 2.3 + i * 0.98, 3.15, 0.82, { fontSize: 13 });
  }
  s.addShape(pres.shapes.LINE, { x: 3.35, y: 4.0, w: 0.45, h: 0, line: { color: K.faint, width: 2, beginArrowType: 'triangle', endArrowType: 'triangle' } });
  s.addShape(pres.shapes.LINE, { x: 8.5, y: 4.0, w: 0.45, h: 0, line: { color: K.faint, width: 2, beginArrowType: 'triangle', endArrowType: 'triangle' } });
  s.addNotes(`FOR Q&A: "How does it work?" / "What if the AI is wrong?"

The AI layer only proposes. The shop engine checks every amount against the words that were said, matches names and products itself, prices everything from the shelf, and writes only after the shopkeeper taps "Haan, likh do". If Gemini is busy or retired, it falls through to other models, then Groq, then offline rules.`);

  // A2. Forecast, honestly
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'For questions' });
  slideNo = 10;
  s.addText('Forecast accuracy, stated honestly', { placeholder: 'title' });
  s.addChart(pres.charts.BAR, [{ name: '14-day total error', labels: ['Calendar-aware (ours)', '7-day average', 'Same day last week'], values: [21.1, 22.7, 22.8] }], {
    x: 0.6, y: 1.55, w: 7.2, h: 4.6, barDir: 'bar', chartColors: [K.sabz, 'C4B89F', 'C4B89F'],
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0"%"', dataLabelFontFace: '+mn-lt', dataLabelFontSize: 14, dataLabelColor: K.ink,
    catAxisLabelFontFace: '+mn-lt', catAxisLabelFontSize: 14, catAxisLabelColor: K.ink, valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 30,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
    showTitle: true, title: 'Error on 14-day totals, lower is better', titleFontFace: '+mn-lt', titleFontSize: 15, titleColor: K.muted,
    barGapWidthPct: 60, catAxisOrientation: 'maxMin', objectName: 'fc-chart',
  });
  s.addText([
    { text: 'What we claim', options: { fontFace: HEAD, fontSize: 18, bold: true, color: K.sabz, breakLine: true } },
    { text: 'On the simulated shop (240 product-windows, rolling 14-day tests), our calendar-aware model is the best of the three. It knows Ramadan and Eid.', options: { fontFace: BODY, fontSize: 15, color: K.muted, breakLine: true } },
    { text: ' ', options: { fontSize: 8, breakLine: true } },
    { text: 'What we don’t', options: { fontFace: HEAD, fontSize: 18, bold: true, color: K.lal, breakLine: true } },
    { text: 'Simulated accuracy is not real-world proof. The app labels its data as a demo on every screen. Next: the same test on a public retail dataset, then the 5-shop pilot.', options: { fontFace: BODY, fontSize: 15, color: K.muted } },
  ], { x: 8.25, y: 1.65, w: 4.45, h: 4.6, valign: 'top', margin: 0, isTextBox: true });
  s.addNotes(`FOR Q&A: "How accurate is the forecast?" / "Is this real data?"

"On the simulated shop, our calendar-aware model beats the simple averages, but simulated accuracy proves nothing about real shops, so we don't claim it. We're testing it on a public dataset of real retail sales next."
Source: docs/forecast_benchmark.md (rolling origin, 8 windows of 14 days per product). If the public benchmark runs before Dec 2, add its number here.`);

  // A3. Privacy, offline, cost
  s = pres.addSlide({ masterName: 'PAPER', sectionTitle: 'For questions' });
  slideNo = 11;
  s.addText('Privacy, offline use and cost', { placeholder: 'title' });
  const qa = [
    { icon: 'LuLock', color: K.lal, light: K.lalLight, head: 'Privacy', line: 'Voice goes to an online AI only after the owner says yes: it’s off by default. The app sends no messages at all: no WhatsApp, no SMS. The data belongs to the shop.' },
    { icon: 'LuWifiOff', color: K.neela, light: K.neelaLight, head: 'No internet', line: 'Typed Urdu, the khata, the cash box, the Rs 50,000 plan and the three jobs all work offline. Turning speech into text needs internet for now.' },
    { icon: 'LuLanguages', color: K.sabz, light: K.sabzLight, head: 'Languages and accents', line: 'Urdu, Punjabi and English, mixed. When unsure, it shows choices instead of guessing, and the shopkeeper can type instead.' },
    { icon: 'LuBanknote', color: K.haldiDark, light: K.haldiLight, head: 'Cost per shop', line: 'A voice entry is one short AI call; most screens use no AI at all. The pilot measures the real cost per shop.' },
  ];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + (i % 2) * 6.1;
    const y = 1.6 + Math.floor(i / 2) * 2.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.85, h: 2.4, fill: { color: K.card }, line: { color: K.line, width: 0.75 }, rectRadius: 0.16 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.8, h: 0.8, fill: { color: qa[i].light }, line: { type: 'none' } });
    s.addImage({ data: await icon(qa[i].icon, qa[i].color), x: x + 0.48, y: y + 0.48, w: 0.44, h: 0.44, altText: qa[i].head });
    s.addText(qa[i].head, { x: x + 1.3, y: y + 0.38, w: 4.3, h: 0.6, fontFace: HEAD, fontSize: 19, bold: true, color: K.ink, valign: 'middle', margin: 0, isTextBox: true });
    s.addText(qa[i].line, { x: x + 0.3, y: y + 1.2, w: 5.3, h: 1.1, fontFace: BODY, fontSize: 15, color: K.muted, valign: 'top', margin: 0, isTextBox: true });
  }
  s.addNotes(`FOR Q&A: privacy, offline, accents, cost. One or two sentences each, then stop.`);

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  fs.writeFileSync(path.join(__dirname, 'anim.json'), JSON.stringify(ANIM, null, 2));
  console.log('wrote', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
