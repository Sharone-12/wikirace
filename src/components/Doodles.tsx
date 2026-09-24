// Small ink pieces shared across pages.

const INK = "var(--ink)";

/** Page footer: a short trail to a flag, and the Wikipedia credit. */
export function SiteFooter() {
  return (
    <footer className="flex shrink-0 items-center gap-4 border-t-[3px] border-ink px-5 py-3 sm:px-8">
      <span className="kicker text-muted">Articles from Wikipedia · CC BY-SA</span>
      <svg viewBox="0 0 200 24" className="ml-auto h-5 w-32 shrink-0 sm:w-48" aria-hidden="true">
        <circle cx="7" cy="14" r="6" fill={INK} />
        <line x1="20" y1="14" x2="172" y2="14" stroke={INK} strokeWidth="3" strokeDasharray="8 8" />
        <line x1="184" y1="23" x2="184" y2="2" stroke={INK} strokeWidth="3" />
        <rect x="184" y="2" width="15" height="10" fill={INK} />
      </svg>
    </footer>
  );
}
