import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Repurposed: was a dark navy scale, now a light-blue surface scale.
        // Numbers preserved so existing class names keep working — the meaning
        // flips: 950 = darkest ink, 900 = card surface (white), descending = lighter.
        navy: {
          950: "#0b2545",   // dark ink (logo, headings on light bg)
          900: "#ffffff",   // card surface
          800: "#eef5fb",   // sticky/secondary surface
          700: "#cfe1ee",   // border
          600: "#94b8ce",   // muted border / divider
        },
        accent: {
          electric: "#0369a1",   // primary action / charge — deep sky blue
          neon: "#0ea5e9",       // highlight — bright sky blue
          green: "#0d9488",      // discharge / positive — teal
          amber: "#b45309",      // warning — readable on light bg
          rose: "#b91c1c",       // error / pessimistic — readable on light bg
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 8px 24px -10px rgba(14, 165, 233, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
