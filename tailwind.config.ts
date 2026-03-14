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
        'bg-primary': '#0a0e17',
        'bg-secondary': '#111827',
        'bg-card': '#1a2035',
        'bg-card-hover': '#1f2847',
        'border-base': '#2a3454',
        'border-active': '#3b4f7a',
        'text-primary': '#e8ecf4',
        'text-secondary': '#8892a8',
        'text-muted': '#5a6478',
      },
      fontFamily: {
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        sans: ['var(--font-noto-sans-kr)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
