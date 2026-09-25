import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/theme";

// This browser's own theme choice, used everywhere except inside a room,
// where the room's theme (set by the host) takes over.
export const THEME_KEY = "wikirace.theme";

/** Runs before first paint (inlined in the root layout) so there's no flash. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="code")document.documentElement.dataset.theme=t}catch(e){}`;

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return isTheme(t) ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the choice just won't outlive this page.
  }
}

/** Show a theme on the page. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
}

// A tiny store so every toggle on screen (and other tabs) stays in step.
const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Save and show this browser's own theme. */
export function chooseTheme(theme: Theme) {
  saveTheme(theme);
  applyTheme(theme);
  listeners.forEach((l) => l());
}
