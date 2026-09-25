// Visual themes. "paper" is the original hand-inked look; "code" is a dark
// code-editor look. A theme is just a data-theme attribute on <html>: the
// paper styles are the defaults and the code theme overrides them in CSS.

export const THEMES = ["paper", "code"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "paper";

export const THEME_LABEL: Record<Theme, string> = {
  paper: "Paper",
  code: "Code",
};

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}
