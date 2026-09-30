/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#F4F5F7',
        line: '#E6E8EB',
        field: '#EDEEF0',
        ink: {
          900: '#17181A',
          600: '#5F6470',
          400: '#9AA0A6'
        },
        brand: {
          50: '#F0FAF3',
          100: '#DFF2E4',
          500: '#00A63E',
          600: '#00913A',
          700: '#007A31'
        },
        peach: {
          100: '#FCE7CF',
          600: '#E2571B'
        },
        sun: {
          100: '#FBF8DC',
          500: '#E7C72C'
        }
      }
    },
  },
  plugins: [],
}
