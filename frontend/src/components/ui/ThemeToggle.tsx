import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "ideaforge-theme";
const THEME_COLORS: Record<ThemeMode, string> = {
  light: "#f8fafc",
  dark: "#0b1220",
};

export function readInitialTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // En modo privado o tests sin almacenamiento persistente, el cambio sigue activo en memoria.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
  const label = theme === "light" ? "Activar tema oscuro" : "Activar tema claro";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
      className="jelly neo-raised inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-200 hover:text-accent-cyan"
    >
      {theme === "light" ? (
        <>
          <FiMoon aria-hidden="true" className="size-4 text-accent-violet" />
          <span className="hidden sm:inline">Tema oscuro</span>
        </>
      ) : (
        <>
          <FiSun aria-hidden="true" className="size-4 text-amber-200" />
          <span className="hidden sm:inline">Tema claro</span>
        </>
      )}
    </button>
  );
}
