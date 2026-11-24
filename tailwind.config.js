export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**",
    "!./dist/**",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ouro': '#66360f',
      }
    },
  },
  plugins: [],
}
