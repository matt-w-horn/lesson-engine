// Theme choice. "auto" follows the OS via color-scheme: light dark; "light"
// and "dark" force a side by stamping data-theme on <html> (tokens.css keys
// on it). Persisted so the choice survives reloads. Guarded for test
// environments with no DOM.
import { signal } from "@preact/signals";

export type Theme = "auto" | "light" | "dark";

const STORAGE_KEY = "lesson-engine.theme";

function readStored(): Theme {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export const theme = signal<Theme>(readStored());

function apply(t: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "auto") delete root.dataset.theme;
  else root.dataset.theme = t;
}

apply(theme.value);

const ORDER: Theme[] = ["auto", "light", "dark"];

/** auto → light → dark → auto. */
export function cycleTheme(): void {
  const next = ORDER[(ORDER.indexOf(theme.value) + 1) % ORDER.length];
  theme.value = next;
  apply(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private-mode storage failures only cost persistence, not the toggle.
  }
}

export const THEME_LABEL: Record<Theme, string> = {
  auto: "Theme: follow the system",
  light: "Theme: light",
  dark: "Theme: dark",
};
