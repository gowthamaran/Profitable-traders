import type { Config } from "tailwindcss";

/**
 * 70% research terminal, 20% crypto product, 10% humor.
 * The palette carries the 70: near-black grounds, off-white text, muted
 * secondary gray, and colour reserved for meaning (green profitable, red
 * unprofitable, amber methodological warning). No purple gradients.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08090a",
          900: "#0c0e10",
          850: "#111417",
          800: "#161a1e",
          700: "#1e2429",
          600: "#2a3238",
        },
        paper: "#e8eaed",
        muted: "#8b949e",
        faint: "#5c656e",
        profit: {
          DEFAULT: "#3fb950",
          dim: "#1f6f2c",
          wash: "rgba(63,185,80,0.12)",
        },
        loss: {
          DEFAULT: "#f05f5f",
          dim: "#8c2f2f",
          wash: "rgba(240,95,95,0.12)",
        },
        warn: {
          DEFAULT: "#d9a441",
          wash: "rgba(217,164,65,0.10)",
        },
        accent: "#58a6ff",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.06em" }],
      },
      borderColor: {
        DEFAULT: "#1e2429",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // Nothing here runs longer than 700ms, per the performance rules.
        "fade-up": "fade-up 320ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
