/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#c9a227',
          light: '#d4b549',
          dark: '#b08f1f',
        },
        dark: {
          DEFAULT: '#0a0a0a',
          card: '#1a1a1a',
          hover: '#252525',
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
