/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand palette: deep-sea blue
        brand: {
          50: "#EEF7F9",
          100: "#DCEFF3",
          200: "#BDDDE7",
          300: "#94C8D8",
          400: "#62AFC3",
          500: "#338FA9",
          600: "#206F88",
          700: "#1B596E",
          800: "#194B5C",
          900: "#183F4D",
          DEFAULT: "#206F88",
          dark: "#1B596E",
          light: "#94C8D8",
        },
        // Accent palette: clear teal
        accent: {
          50: "#ECFBF7",
          100: "#D3F5EC",
          200: "#A9EADB",
          300: "#78DBC4",
          400: "#44C9AC",
          500: "#1DAF92",
          600: "#0F8D76",
          700: "#127263",
          800: "#145C51",
          900: "#154C44",
          DEFAULT: "#1DAF92",
          dark: "#127263",
          light: "#A9EADB",
        },
      },
      boxShadow: {
        brand: "0 14px 34px rgba(32,111,136,.18)",
        accent: "0 14px 34px rgba(29,175,146,.16)",
        soft: "0 8px 24px rgba(15,23,42,.08)",
      },
      fontFamily: {
        display: ["'Sora'", "ui-sans-serif", "system-ui"],
        body: ["'Manrope'", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        floatBig: {
          "0%,100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(8px, -20px)" },
          "50%": { transform: "translate(0, -28px)" },
          "75%": { transform: "translate(-8px, -20px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        floatFast: "float 3s ease-in-out infinite",
        floatBig: "floatBig 5s ease-in-out infinite",
        floatBigFast: "floatBig 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
