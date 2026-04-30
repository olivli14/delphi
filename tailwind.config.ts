import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070b1a",
          900: "#0a1024",
          800: "#0f1733",
          700: "#152045",
          600: "#1c2c5e",
        },
        accent: {
          electric: "#3b82f6",
          neon: "#22d3ee",
          green: "#34d399",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -8px rgba(59, 130, 246, 0.55)",
      },
    },
  },
  plugins: [],
};
export default config;
