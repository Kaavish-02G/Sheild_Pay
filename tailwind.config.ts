import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "grid-cols-2",
    "grid-cols-3",
    "grid-cols-4",
    "sm:grid-cols-2",
    "sm:grid-cols-3",
    "md:grid-cols-2",
    "md:grid-cols-4",
    "lg:grid-cols-2",
    "lg:grid-cols-3",
    "lg:grid-cols-4",
    "hidden",
    "flex",
    "md:hidden",
    "md:flex",
    "sm:inline",
    "sm:flex-row",
    "sm:col-span-2",
    "lg:col-span-2",
    "lg:col-span-3",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
