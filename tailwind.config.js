/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: '#0f1117',
        paper: '#f7f5f0',
        accent: '#c8401a',
        muted: '#6b6b6b',
        border: '#e2ddd6',
        success: '#1a7a4a',
        warning: '#b87d00',
        danger: '#c8401a',
      },
    },
  },
  plugins: [],
}
