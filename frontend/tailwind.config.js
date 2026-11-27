/** @type {import('tailwindcss').Config} */
// HisaabAI design tokens. Light, high-contrast, built for a bright shop and tired eyes.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F7F3', // page background: register-paper white
        card: '#FFFFFF',
        ink: { DEFAULT: '#17201B', soft: '#2F3A33', muted: '#56605A', faint: '#7C867F' },
        line: { DEFAULT: '#DCE1D9', strong: '#C4CCC1' },
        sabz: { DEFAULT: '#0E6B3F', dark: '#0A4F2E', tint: '#E4F1E8', mid: '#BFDDC9' },
        haldi: { DEFAULT: '#E8A317', dark: '#9A5B00', tint: '#FDF3DC' },
        lal: { DEFAULT: '#C0392B', dark: '#962D22', tint: '#FCE9E7' },
        neela: { DEFAULT: '#2A5BA8', tint: '#E6EEF9' }, // register ruling blue
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
      },
      keyframes: {
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(232,163,23,0.55)' }, '100%': { boxShadow: '0 0 0 14px rgba(232,163,23,0)' } },
      },
      animation: { 'pulse-ring': 'pulse-ring 1.6s ease-out infinite' },
    },
  },
  plugins: [],
};
