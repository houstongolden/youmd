import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,mdx}",
    "./convex/**/*.{js,jsx,ts,tsx}",
    "./cli/**/*.{js,jsx,ts,tsx,md}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;

