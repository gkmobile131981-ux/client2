import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        gk: {
          900: '#081f3d',
          800: '#0d2a51',
          700: '#14386d',
          500: '#3f6aa0',
          gold: '#c49b2e'
        }
      },
      boxShadow: {
        glow: '0 20px 50px rgba(20, 60, 120, 0.18)'
      }
    }
  },
  plugins: []
};

export default config;
