import Link from "next/link";

/**
 * WikiRace mark in a drawn circle: two article pages joined by a dashed hop,
 * the same trail-of-clicks idea as the landing illustration.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="block shrink-0"
    >
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="14" width="8" height="10" stroke="currentColor" strokeWidth="1.6" />
      <rect x="18" y="8" width="8" height="10" fill="currentColor" />
      <path d="M11 13 Q12 7 17 9" stroke="currentColor" strokeWidth="1.6" strokeDasharray="1.8 1.8" />
    </svg>
  );
}

/** Script wordmark with the circle mark, linking home. */
export function Brand({ tagline = "race through wikipedia" }: { tagline?: string }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="WikiRace home">
      <Logo />
      <span className="flex flex-col">
        <span className="font-script text-[30px] leading-[0.8]">wikirace</span>
        <span className="kicker mt-1 text-[8.5px] tracking-[0.2em] text-muted">{tagline}</span>
      </span>
    </Link>
  );
}

/** Top-right navigation, bold uppercase like a shop front. */
export function NavLinks() {
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:gap-x-5">
      <Link href="/" className="nav-link">
        Solo
      </Link>
      <Link href="/play" className="nav-link">
        Multiplayer
      </Link>
      <a href="https://en.wikipedia.org" target="_blank" rel="noreferrer" className="nav-link hidden sm:inline">
        Wikipedia ↗
      </a>
    </nav>
  );
}

/** Page header: brand on the left, whatever sits on the right (nav by default). */
export function TopBar({ tagline, right }: { tagline?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Brand tagline={tagline} />
      {right ?? <NavLinks />}
    </div>
  );
}
