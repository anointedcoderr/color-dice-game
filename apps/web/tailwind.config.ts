import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0B0B12", soft: "#13131C", card: "#181824" },
        dice: {
          red: "#FF3B5C",
          black: "#1E1E24",
          blue: "#2D7DFF",
          green: "#21E6A4",
          yellow: "#FFD23F",
          white: "#F5F7FF",
          neutral: "#2A2A35",
        },
      },
      boxShadow: {
        "glow-red": "0 0 50px 6px rgba(255,59,92,0.6)",
        "glow-blue": "0 0 50px 6px rgba(45,125,255,0.6)",
        "glow-green": "0 0 50px 6px rgba(33,230,164,0.6)",
        "glow-yellow": "0 0 50px 6px rgba(255,210,63,0.6)",
        "glow-white": "0 0 50px 6px rgba(245,247,255,0.7)",
        "glow-black": "0 0 50px 6px rgba(120,120,140,0.5)",
        "glow-brand": "0 0 40px rgba(168,85,247,0.5)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.7" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
