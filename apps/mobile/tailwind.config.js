/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
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
        mono: ["JetBrainsMono_400Regular", "SpaceMono_400Regular", "monospace"],
        "mono-bold": ["JetBrainsMono_700Bold", "SpaceMono_700Bold", "monospace"],
      },
    },
  },
  plugins: [],
};
