import type { Config } from "tailwindcss";

const config = {
  // ✅ 「.dark」クラスを使う場合はタプルで書く
  darkMode: ["class", ".dark"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;

export default config;
