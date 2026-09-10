"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className="rounded-md border border-white/15 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-[#d8d0c4]"
    >
      {isDark ? "Day" : "Night"}
    </button>
  );
}
