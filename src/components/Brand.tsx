import Link from "next/link";

/** WikiRace mark: a cursor arrow in a solid ink disc, the click that moves you on. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="block shrink-0">
      <circle cx="16" cy="16" r="16" fill="currentColor" />
      <path d="M11.5 7.5 V23 L15.2 19.6 L17.8 25 L20.4 23.8 L17.8 18.4 L22.8 18.2 Z" fill="var(--bg)" />
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
