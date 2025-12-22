/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Discord renklerini buraya ekleyelim ki App.jsx içindeki kodlar çalışsın
      colors: {
        discord: {
          dark: '#36393f',
          darker: '#2f3136',
          darkest: '#202225',
          light: '#b9bbbe',
          primary: '#5865F2'
        }
      }
    },
  },
  plugins: [],
}