/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'team-usa': '#DC2626',
        'team-europe': '#2563EB',
      },
    },
  },
  plugins: [],
}