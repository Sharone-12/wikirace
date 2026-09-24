import Link from "next/link";

/**
 * WikiRace mark: a route of stations ending at the target. Stations are ink
 * circles; the terminus is an amber square, matching the square-means-target
 * encoding used on the route maps. So the glyph is the thing you play.
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
      <path
        d="M4 24 L12 14 L20 18 L27 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <g fill="currentColor">
        <circle cx="4.5" cy="23.5" r="2.6" />
        <circle cx="12" cy="14" r="2.6" />
        <circle cx="20" cy="18" r="2.6" />
      </g>
      <rect x="22.6" y="2.6" width="8.8" height="8.8" rx="1.8" fill="var(--sun)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Wordmark with the mark, linking home. */
export function Brand({ tagline = "race through wikipedia" }: { tagline?: string }) {
  return (
    <Link href="/" className="inline-block" aria-label="WikiRace home">
      <span className="flex items-center gap-2">
        <Logo />
        <span className="text-[26px] font-black leading-none tracking-[-0.055em]">wikirace.</span>
      </span>
      <span className="kicker mt-1.5 block text-[8.5px] tracking-[0.15em] text-muted">{tagline}</span>
    </Link>
  );
}

/** Numbered colour-block card, the mulenet nav-card pattern. */
export function BlockLink({
  href,
  n,
  label,
  color,
}: {
  href: string;
  n: string;
  label: string;
  color: string; // bg-* and text-* classes
}) {
  return (
    <Link
      href={href}
      className={`lift relative flex min-h-24 flex-col justify-between rounded-2xl p-3.5 ${color}`}
    >
      <span className="text-[21px] font-extrabold tracking-tight">{n}</span>
      <span className="absolute right-3.5 top-3 font-bold" aria-hidden="true">
        ↗
      </span>
      <span className="text-sm font-bold leading-tight">{label}</span>
    </Link>
  );
}
