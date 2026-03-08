/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand palette: energetic orange
        brand: {
          DEFAULT: "#F97316", // orange-500
          dark:    "#EA580C", // orange-600
          light:   "#FDBA74", // orange-300
        },
        // Accent palette: amber / sunrise yellow
        accent: {
          DEFAULT: "#F59E0B", // amber-500
          dark:    "#D97706", // amber-600
          light:   "#FDE68A", // amber-200
        },
      },
      // Soft neon-style shadows in the orange/yellow family
      boxShadow: {
        brand: "0 10px 30px rgba(249,115,22,.18)",     // Orange glow
        amber: "0 10px 30px rgba(245,158,11,.16)",     // Amber glow
        soft:  "0 6px 20px rgba(17,24,39,.06)",        // General-purpose soft shadow
      },
      ringColor: {
        brand: "#F97316",
        accent: "#F59E0B",
      },
      fontFamily: {
        display: ["'Inter'", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        // Larger float with subtle horizontal drift
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
      // Convenience gradient slots (for buttons/blocks)
      gradientColorStops: {
        // Tailwind already includes these; this just documents the recommended combo: from-brand to-accent
      },
    },
  },
  plugins: [],
};
