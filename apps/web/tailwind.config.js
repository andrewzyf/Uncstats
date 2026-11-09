/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F4F0",
        ink: "#111111",
        warning: "#FF4F00",
        muted: "#6B6B66",
        rule: "#C8C8C0",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Space Mono"', "ui-monospace", "monospace"],
      },
      backgroundImage: {
        receipt:
          "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(17,17,17,0.04) 24px)",
      },
    },
  },
  plugins: [],
};
