/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        primaryDark: "#312E81",
        accent: "#F97316",
        bgDark: "#050816",
        bgLight: "#F3F4F6"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.25)"
      },
      borderRadius: {
        xl: "1.25rem"
      }
    }
  },
  plugins: []
};

