import type { Config } from 'tailwindcss';

/**
 * PhysiQ design tokens: Apple Fitness structure in a darker palette.
 * True-black canvas, layered near-black surfaces, and three saturated ring
 * colours (train / protein / water) that carry the meaning across the app.
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
          2: '#A1A1A6',
          3: '#6E6E73',
        },
        train: { DEFAULT: '#FA2D55', deep: '#B3123A' },
        protein: { DEFAULT: '#B6F23B', deep: '#6FA312' },
        water: { DEFAULT: '#2DD4F5', deep: '#0E7FA0' },
        accent: '#B6F23B',
        recover: '#FFB020',
        gold: '#FFD60A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        round: ['var(--font-nunito)', 'ui-rounded', 'var(--font-inter)', 'sans-serif'],
      },
      fontSize: {
        'large-title': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '700' }],
        title: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em', fontWeight: '700' }],
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
