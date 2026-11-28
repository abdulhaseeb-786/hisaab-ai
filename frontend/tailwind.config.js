/** @type {import('tailwindcss').Config} */
// HisaabAI design tokens. Light, high-contrast, built for a bright shop and tired eyes.
//
// Five colour families, each a full scale (50 lightest ... 950 darkest), taken from the shop:
//   sabz   the painted signboard green   the shop, actions, "Aaj"
//   haldi  turmeric                       money: cash box, wasooli, "Hisaab"
//   lal    the red khata register cloth   credit and urgency: "Khata", late money
//   neela  register ruling ink            goods and records: "Order", "Stock", tomorrow
//   ink    ledger paper to ink            neutrals: page, lines, text
// The old names (sabz.dark, lal.tint, ink.muted, ...) stay as aliases onto the scales.

const sabz = {
  50: '#EEF7F1', 100: '#D7EDDF', 200: '#B2DBC1', 300: '#82C29C', 400: '#4FA374', 500: '#1F8553',
  600: '#0E6B3F', 700: '#0A5532', 800: '#084227', 900: '#06301D', 950: '#031C11',
};
const haldi = {
  50: '#FEF8EC', 100: '#FCEDCC', 200: '#F9DB99', 300: '#F4C35F', 400: '#E8A317', 500: '#CC8A0C',
  600: '#A86F07', 700: '#865606', 800: '#654107', 900: '#4A3008', 950: '#2B1B03',
};
const lal = {
  50: '#FDF1EF', 100: '#FADDD9', 200: '#F4B9B1', 300: '#EA8B7F', 400: '#DC5F51', 500: '#C0392B',
  600: '#A02E22', 700: '#84261C', 800: '#681E17', 900: '#4E1712', 950: '#2E0C09',
};
const neela = {
  50: '#EFF4FB', 100: '#DCE6F6', 200: '#B9CDEC', 300: '#8DADDF', 400: '#5E88CC', 500: '#3C6BB9',
  600: '#2A5BA8', 700: '#22488A', 800: '#1D3A6E', 900: '#182F57', 950: '#0E1B34',
};
const ink = {
  50: '#FAF5EC', 100: '#F2EBD9', 200: '#E4DAC6', 300: '#CFC3AB', 400: '#A19887', 500: '#7A7265',
  600: '#595349', 700: '#413D35', 800: '#2E2B25', 900: '#1B1915', 950: '#0F0E0B',
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: ink[50], // page background: register-paper white
        card: '#FFFFFF',
        ink: { ...ink, DEFAULT: ink[900], soft: ink[800], muted: ink[600], faint: ink[500] },
        line: { DEFAULT: ink[200], strong: ink[300] },
        sabz: { ...sabz, DEFAULT: sabz[600], dark: sabz[800], tint: sabz[50], mid: sabz[200] },
        haldi: { ...haldi, DEFAULT: haldi[400], dark: haldi[700], tint: haldi[50] },
        lal: { ...lal, DEFAULT: lal[500], dark: lal[600], tint: lal[50] },
        neela: { ...neela, DEFAULT: neela[600], dark: neela[800], tint: neela[50] },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }], // 13
        sm: ['0.9375rem', { lineHeight: '1.4rem' }], // 15
        base: ['1.0625rem', { lineHeight: '1.65rem' }], // 17
        lg: ['1.1875rem', { lineHeight: '1.75rem' }], // 19
        xl: ['1.375rem', { lineHeight: '1.9rem' }], // 22
        '2xl': ['1.75rem', { lineHeight: '2.2rem' }], // 28
        '3xl': ['2.25rem', { lineHeight: '2.6rem' }], // 36
        '4xl': ['3rem', { lineHeight: '3.3rem' }], // 48
        '5xl': ['3.75rem', { lineHeight: '4rem' }], // 60
        '6xl': ['4.5rem', { lineHeight: '4.6rem' }], // 72
      },
      borderRadius: { sheet: '1.5rem' },
      boxShadow: {
        card: '0 1px 0 rgba(23,32,27,0.04), 0 1px 3px rgba(23,32,27,0.06)',
        lift: '0 8px 28px -8px rgba(23,32,27,0.18)',
        slip: '0 1px 0 rgba(23,32,27,0.05), 0 10px 30px -12px rgba(14,107,63,0.25)',
        // The register lying on the signboard: a deep, green-tinted shadow.
        board: '0 30px 60px -24px rgba(3,28,17,0.65), 0 12px 24px -12px rgba(3,28,17,0.5)',
      },
      keyframes: {
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(232,163,23,0.55)' }, '100%': { boxShadow: '0 0 0 14px rgba(232,163,23,0)' } },
      },
      animation: { 'pulse-ring': 'pulse-ring 1.6s ease-out infinite' },
    },
  },
  plugins: [],
};
