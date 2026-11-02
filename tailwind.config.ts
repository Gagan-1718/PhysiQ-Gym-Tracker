import type { Config } from 'tailwindcss';

/**
 * PhysiQ design tokens, taken from the logo: true-black canvas, layered near-black
 * surfaces, brand red, and the logo's silver-white. Three ring colours carry the
 * meaning across the app: train (red), protein (white), water (blue).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#000000',
        surface: {
          1: '#0D0D0F',
          2: '#17171A',
          3: '#212125',
          4: '#2C2C31',
        },
        line: 'rgba(255, 255, 255, 0.07)',
        fg: {
          DEFAULT: '#F5F5F7',
          2: '#B4B4BA',
          3: '#919197',
        },
        // Brand red, sampled from the logo. DEFAULT is for text, icons, borders and rings on dark surfaces (6:1 on black);
        // solid is for filled buttons that carry white text (5:1).
        accent: { DEFAULT: '#FF4B2B', solid: '#D9230F', deep: '#8F1308' },
        train: { DEFAULT: '#FF4B2B', deep: '#B01A0E' },
        // The white half of the logo's Q: nutrition ring and neutral highlights
        protein: { DEFAULT: '#EDEDF0', deep: '#8B8B93' },
        water: { DEFAULT: '#3CC8F2', deep: '#0E7FA0' },
        recover: '#FFB020',
        gold: '#FFD60A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
        wordmark: ['var(--font-display-italic)', 'var(--font-display)', 'sans-serif'],
      },
      fontSize: {
        'large-title': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.01em', fontWeight: '800' }],
        title: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.005em', fontWeight: '800' }],
        headline: ['1.0625rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        footnote: ['0.8125rem', { lineHeight: '1.125rem' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      borderRadius: {
        card: '1.375rem',
        field: '0.875rem',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
      },
    },
  },
  plugins: [],
};

export default config;
