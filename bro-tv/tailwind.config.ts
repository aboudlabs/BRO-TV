import type { Config } from 'tailwindcss';

/**
 * ألوان الهوية مستخرجة من الشعار ولوحة الألوان:
 *  - Imperial purple  #3C1A4F  (خلفية الشعار)
 *  - Champagne        #F7E7CE  (فرو حرف B)
 * باقي الدرجات مشتقة منهما لبناء ثيم داكن فخم.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#3C1A4F',
          champagne: '#F7E7CE',
        },
        ink: {
          950: '#12081A',
          900: '#190C24',
          800: '#22112F',
          700: '#2D1740',
          600: '#3C1A4F',
          500: '#55306C',
          400: '#7A5590',
        },
        champagne: {
          50: '#FEFBF6',
          100: '#FBF3E6',
          200: '#F7E7CE',
          300: '#EFD5AE',
          400: '#E4BF88',
          500: '#D6A463',
        },
      },
      fontFamily: {
        sans: ['"Cairo Variable"', 'Cairo', 'system-ui', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(10, 3, 16, 0.45)',
        glow: '0 0 40px rgba(247, 231, 206, 0.18)',
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(0) scale(0.6)', opacity: '0' },
          '10%': { transform: 'translateY(-12px) scale(1.1)', opacity: '1' },
          '100%': { transform: 'translateY(-280px) scale(1.5) rotate(14deg)', opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '40%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        'float-up': 'float-up 3.2s ease-out forwards',
        pop: 'pop 0.45s ease-out both',
        'fade-in': 'fade-in 0.25s ease-out both',
        glow: 'glow 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
