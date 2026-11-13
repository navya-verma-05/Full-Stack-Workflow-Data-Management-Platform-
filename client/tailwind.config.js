/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        paper: {
          light: '#F6F4EF',
          dark: '#141413',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1C1C1A',
        },
        hairline: {
          light: '#E4E1DA',
          dark: '#2B2A27',
        },
        ink: {
          light: '#1B1B1A',
          dark: '#ECE9E2',
          muted: '#6B6B66',
          'muted-dark': '#8E8B82',
        },
        status: {
          processed: '#2E7D32',
          'processed-dark': '#4ADE80',
          invalid: '#B45309',
          'invalid-dark': '#FBBF24',
          failed: '#C2410C',
          'failed-dark': '#FB923C',
          dead_letter: '#B91C1C',
          'dead_letter-dark': '#F87171',
        },
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '3px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
