/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        empresa: {
          blue: '#205DF5',
          'blue-light': '#4a7ef7',
          'blue-dark': '#1648c7',
          50: '#EFF6FF',
        },
        status: {
          green:  '#1E9640',
          yellow: '#F0A900',
          red:    '#E60975',
          gray:   '#94a3b8',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,.10), 0 2px 4px -2px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}
