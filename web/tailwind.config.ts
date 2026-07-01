import type { Config } from "tailwindcss";

// kaivo.studio Brand-Tokens: Signal-Magenta, editorial-minimal, Geist.
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        signal: {
          DEFAULT: "#FF006E", // Signal-Magenta
          50: "#FFE5F1",
          600: "#E60063",
          700: "#B3004D",
        },
        ink: {
          DEFAULT: "#0A0A0A",
          muted: "#6B7280",
          line: "#E5E7EB",
        },
        paper: "#FFFFFF",
        canvas: "#FAFAFA",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
