import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Hebrew-first color scheme: military olive/green tones
      colors: {
        olive: {
          50:  '#f6f7f0',
          100: '#e8ebda',
          200: '#d2d8b8',
          300: '#b4be8a',
          400: '#97a561',
          500: '#7a8a42',
          600: '#5f6c32',
          700: '#4a5428',
          800: '#3c4422',
          900: '#333a1e',
        },
        military: {
          DEFAULT: '#4a5428',
          dark: '#3c4422',
          light: '#7a8a42',
        },
      },
      fontFamily: {
        // Hebrew-compatible sans-serif stack
        sans: ['Rubik', 'Assistant', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
