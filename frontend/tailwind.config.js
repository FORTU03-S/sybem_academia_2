/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js}",
    "./dist/**/*.html",
    "../templates/**/*.html",
  ],

  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        secondary: "#1e40af",
        base: "#f9fafb",
        dark: "#111827",
      },
    },
  },

  plugins: [],
}
