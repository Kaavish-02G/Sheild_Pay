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
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-offset-slate-900"
    >
      <span
        className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white text-xs shadow-sm transition-transform dark:bg-slate-200 ${
          isDark ? "translate-x-6" : "translate-x-1"
        }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
