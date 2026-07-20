"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-16 h-7" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-3.5 py-2 text-white hover:bg-white/20 transition"
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
    >
      {isDark ? "☀️ Modo claro" : "🌙 Modo escuro"}
    </button>
  );
}
