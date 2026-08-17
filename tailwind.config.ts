import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/layouts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rfs: {
          50: '#eef1fb',
          100: '#dde2f7',
          200: '#b9c3ef',
          300: '#8e9ce2',
          400: '#6472d0',
          500: '#3f4bb8',
          600: '#2a339c',
          700: '#152483',
          800: '#111d6b',
          900: '#0d1650',
          950: '#070c30',
          navy: '#152483',
          'navy-dark': '#0d1650',
          orange: '#f16e26',
          purple: '#152483',
          'purple-deep': '#0d1650',
          bg: '#f4f6fb',
          info: '#d9edf7',
          'info-border': '#bce8f1',
          link: '#152483',
        },
        rfsorange: {
          50: '#fff5ed',
          100: '#ffe8d4',
          200: '#fecda8',
          300: '#fdaa71',
          400: '#fb8038',
          500: '#f16e26',
          600: '#e05310',
          700: '#ba3d0f',
          800: '#943214',
          900: '#782c13',
        },
        'dms-bg': '#f4f6fb',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        brand: '0 18px 40px -18px rgba(21, 36, 131, 0.45)',
        'brand-lg': '0 30px 70px -25px rgba(21, 36, 131, 0.55)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -22px, 0) scale(1.05)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        shake: 'shake 0.4s ease',
        'float-slow': 'float-slow 14s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
