/** @type {import('tailwindcss').Config} */
module.exports = {
  // Chemins larges pour Django, essentiels pour éviter la purge agressive
  content: [
    "./**/templates/**/*.html",
    "./templates/**/*.html",
    "./**/*.html",
    // Nous retirons les safelist temporairement pour voir si le nettoyage a fonctionné
  ],
  
  theme: {
    extend: {
      colors: {
        'primary': '#0078D4',
        'secondary': '#6264A7',
        'bg-base': '#F3F4F6',
        'bg-dark': '#1F1F1F',
      },
    },
  },
  
  plugins: [],
}