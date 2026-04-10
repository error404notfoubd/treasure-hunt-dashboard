/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#07090D",
          1: "#0D1117",
          2: "#151B25",
          3: "#1C2333",
          4: "#243044",
        },
        ink: {
          1: "#E6EDF3",
          2: "#9EAAB8",
          3: "#5E6B7A",
          4: "#3B4453",
        },
        accent: {
          DEFAULT: "#4A9EF5",
          hover: "#6DB3FF",
          muted: "rgba(74,158,245,0.12)",
          subtle: "rgba(74,158,245,0.06)",
        },
        danger: {
          DEFAULT: "#F04438",
          muted: "rgba(240,68,56,0.12)",
        },
        success: {
          DEFAULT: "#32D583",
          muted: "rgba(50,213,131,0.12)",
        },
        warn: {
          DEFAULT: "#F5B731",
          muted: "rgba(245,183,49,0.12)",
        },
      },
      fontFamily: {
        sans: ['"Outfit"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in-right": "slideInRight 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
