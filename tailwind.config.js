/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./store/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "brand-dark": "#0D0D0D",
        "brand-green": "#A8FF3E",
        "brand-muted": "#666666",
      },
      fontFamily: {
        sora: ["Sora_400Regular"],
        "sora-medium": ["Sora_500Medium"],
        "sora-semibold": ["Sora_600SemiBold"],
        "sora-bold": ["Sora_700Bold"],
        dm: ["DMSans_400Regular"],
        "dm-medium": ["DMSans_500Medium"],
        "dm-bold": ["DMSans_700Bold"],
      },
    },
  },
  plugins: [],
};
