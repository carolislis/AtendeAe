import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#e6f7ee', 100: '#b3e6cc', 200: '#80d4aa', 300: '#4dc288', 400: '#25b070', 500: '#128c4c', 600: '#0f7540', 700: '#0c5e34', 800: '#094728', 900: '#06301c' },
        whatsapp: '#25D366',
      },
    },
  },
  plugins: [],
};

export default config;
