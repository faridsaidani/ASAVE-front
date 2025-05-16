/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // This should cover all your React components
  ],
  theme: {
    extend: {
      fontFamily: {
        // Example: Add Inter font if you include it via CDN or locally
        // sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}