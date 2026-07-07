/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          deepblue: '#1E3A8A',
          emerald: '#10B981',
          orange: '#F97316',
          slate: '#64748B',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          light: '#FFFFFF',
          dark: '#0F172A',
        },
        dark: {
          bg: '#020617',
          surface: '#0F172A',
          'surface-soft': '#111827',
          border: '#1E293B',
          text: '#F8FAFC',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
        heading: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        'premium': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 10px 15px -3px rgb(0 0 0 / 0.04)',
        'dark-card': '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
        'dark-premium': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 10px 15px -3px rgb(0 0 0 / 0.3)',
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
  plugins: [],
};
