import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#001524",
          900: "#03212e",
          800: "#0a3a48",
          700: "#15616d",
          600: "#1f7e8a",
        },
        accent: {
          electric: "#ff7d00",
          neon: "#ffecd1",
          green: "#3fb8c4",
          amber: "#ffecd1",
          rose: "#78290f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -8px rgba(255, 125, 0, 0.55)",
      },
    },
  },
  plugins: [],
};
export default config;
