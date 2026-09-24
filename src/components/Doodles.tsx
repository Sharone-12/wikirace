// Ink doodles for the game: Wikipedia articles as paper cards, joined by a
// dashed click-trail that ends at a flagged target, with a cursor, a
// stopwatch, and a stack of books. Ink on paper, no colour.

const INK = "var(--ink)";
const PAPER = "var(--bg)";
const CONDENSED = { fontFamily: "var(--font-condensed), sans-serif" };

const ROWS = [0.82, 0.64, 0.9, 0.55, 0.74];

/** An article card: title bar, text lines, and one bold underlined link. */
function Article({
  x,
  y,
  rot,
  link,
  dark = false,
}: {
  x: number;
  y: number;
  rot: number;
  link: { row: number; from: number; to: number };
  dark?: boolean;
}) {
  const w = 170;
  const h = 130;
  const fg = dark ? PAPER : INK;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2})`}>
      <rect x="7" y="7" width={w} height={h} fill={INK} />
      <rect width={w} height={h} fill={dark ? INK : PAPER} stroke={INK} strokeWidth="2.5" />
      <rect x="16" y="15" width={w * 0.5} height="10" fill={fg} />
      <line x1="16" y1="34" x2={w - 16} y2="34" stroke={fg} strokeWidth="1.5" />
      {ROWS.map((len, i) => {
        const ry = 50 + i * 16;
        const isLink = i === link.row;
        return (
          <g key={i}>
            <line
              x1="16"
              y1={ry}
              x2={16 + (w - 32) * len}
              y2={ry}
              stroke={fg}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.28"
            />
            {isLink && (
              <>
                <line x1={link.from} y1={ry} x2={link.to} y2={ry} stroke={fg} strokeWidth="4.5" strokeLinecap="round" />
                <line x1={link.from} y1={ry + 5} x2={link.to} y2={ry + 5} stroke={fg} strokeWidth="1.5" />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** A dashed hop between articles, with the click number on it. */
function Hop({ d, n, cx, cy, running }: { d: string; n: number; cx: number; cy: number; running: boolean }) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="9 9"
        strokeLinecap="round"
        markerEnd="url(#hop-arrow)"
        className={running ? "route-run" : undefined}
      />
      <circle cx={cx} cy={cy} r="14" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <text x={cx} y={cy + 5.5} textAnchor="middle" fontSize="16" fontWeight="600" fill={INK} style={CONDENSED}>
        {n}
      </text>
    </g>
  );
}

/** Four-point sparkle. */
function Spark({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      d={`M${x} ${y - 12 * s} Q${x} ${y} ${x + 12 * s} ${y} Q${x} ${y} ${x} ${y + 12 * s} Q${x} ${y} ${x - 12 * s} ${y} Q${x} ${y} ${x} ${y - 12 * s} Z`}
      fill={INK}
    />
  );
}

function Stopwatch({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const ticks = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
  // The elapsed part of the minute, hatched: from 12 o'clock round to about 4.
  const end = -Math.PI / 2 + (Math.PI * 2 * 4) / 12;
  const ir = r - 12;
  const sector = `M${cx} ${cy} L${cx} ${cy - ir} A${ir} ${ir} 0 0 1 ${cx + Math.cos(end) * ir} ${cy + Math.sin(end) * ir} Z`;
  return (
    <g stroke={INK} strokeLinecap="round">
      <rect x={cx - 11} y={cy - r - 22} width="22" height="14" fill={INK} />
      <line x1={cx} y1={cy - r - 8} x2={cx} y2={cy - r} strokeWidth="6" />
      <line x1={cx + r * 0.72} y1={cy - r * 0.78} x2={cx + r * 0.86} y2={cy - r * 0.93} strokeWidth="7" />
      <circle cx={cx + 7} cy={cy + 7} r={r} fill={INK} />
      <circle cx={cx} cy={cy} r={r} fill={PAPER} strokeWidth="3" />
      <path d={sector} fill="url(#hatch)" stroke="none" />
      {ticks.map((a, i) => (
        <line
          key={i}
          x1={cx + Math.cos(a) * (r - 4)}
          y1={cy + Math.sin(a) * (r - 4)}
          x2={cx + Math.cos(a) * (r - (i % 3 === 0 ? 14 : 9))}
          y2={cy + Math.sin(a) * (r - (i % 3 === 0 ? 14 : 9))}
          strokeWidth={i % 3 === 0 ? 3 : 2}
        />
      ))}
      <line x1={cx} y1={cy} x2={cx + Math.cos(end) * (r - 16)} y2={cy + Math.sin(end) * (r - 16)} strokeWidth="3.5" />
      <circle cx={cx} cy={cy} r="4.5" fill={INK} />
    </g>
  );
}

function Books() {
  return (
    <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
      <rect x="20" y="396" width="150" height="30" fill={INK} />
      <path d="M36 404 v14 M150 404 v14" stroke={PAPER} strokeWidth="2" />
      <rect x="34" y="366" width="128" height="30" fill={PAPER} />
      <path d="M34 381 H162" strokeWidth="1.5" />
      <rect x="120" y="366" width="12" height="30" fill={INK} />
      <rect x="12" y="336" width="140" height="30" fill={INK} />
      <path d="M26 344 h40 M26 358 h24" stroke={PAPER} strokeWidth="2" />
      <text x="118" y="357" textAnchor="middle" fontSize="15" fill={PAPER} stroke="none" style={CONDENSED}>
        A–Z
      </text>
    </g>
  );
}

function Cursor({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round">
        <line x1={x - 8} y1={y - 12} x2={x - 14} y2={y - 22} />
        <line x1={x - 14} y1={y} x2={x - 26} y2={y - 2} />
        <line x1={x + 2} y1={y - 16} x2={x + 4} y2={y - 28} />
      </g>
      <path
        d={`M${x} ${y} l0 42 l11 -10 l8 18 l8 -3.5 l-8 -18 l15 -1 Z`}
        fill={PAPER}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

function CheckeredFlag({ x, y }: { x: number; y: number }) {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++)
      if ((r + c) % 2 === 0) cells.push(<rect key={`${r}${c}`} x={x + c * 10} y={y + r * 10} width="10" height="10" fill={INK} />);
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 70} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <rect x={x} y={y} width="50" height="30" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      {cells}
    </g>
  );
}

/** Landing illustration: start article → three clicks → flagged target, against the clock. */
export function HeroScene({ running = false }: { running?: boolean }) {
  return (
    <svg
      viewBox="0 20 1200 420"
      className="block h-auto w-full"
      role="img"
      aria-label="Ink drawing: a trail of Wikipedia articles linked by numbered clicks, ending at a flagged target, beside a stopwatch and a stack of books"
    >
      <defs>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill={INK} opacity="0.22" />
        </pattern>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeWidth="2.5" />
        </pattern>
        <marker id="hop-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
        </marker>
      </defs>

      {/* abstract backdrop: a dotted disc inside a dashed orbit */}
      <circle cx="620" cy="235" r="190" fill="url(#dots)" />
      <circle cx="620" cy="235" r="215" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
      <path d="M70 110 q20 -24 40 0 t40 0 t40 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M1010 420 q16 -20 32 0 t32 0 t32 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <text x="96" y="250" fontSize="80" fill="none" stroke={INK} strokeWidth="1.8" style={{ fontFamily: "var(--font-serif), serif" }}>
        §
      </text>
      <text x="1100" y="130" fontSize="72" fill="none" stroke={INK} strokeWidth="1.8" style={{ fontFamily: "var(--font-serif), serif" }}>
        ¶
      </text>
      <Spark x={330} y={80} />
      <Spark x={360} y={108} s={0.55} />
      <Spark x={800} y={420} s={0.8} />
      <Spark x={1150} y={230} s={0.7} />
      <Spark x={60} y={300} s={0.6} />

      <Books />

      <text x="190" y="236" fontSize="15" letterSpacing="3" fill={INK} style={CONDENSED}>
        START
      </text>
      <Article x={190} y={245} rot={-5} link={{ row: 2, from: 24, to: 92 }} />
      <Article x={420} y={130} rot={4} link={{ row: 3, from: 80, to: 140 }} />
      <Article x={660} y={215} rot={-3} link={{ row: 0, from: 96, to: 150 }} />
      <text x="892" y="86" fontSize="15" letterSpacing="3" fill={INK} style={CONDENSED}>
        TARGET
      </text>
      <Article x={890} y={95} rot={4} link={{ row: 1, from: 20, to: 120 }} dark />
      <CheckeredFlag x={1036} y={30} />

      <Hop d="M284 322 C340 330 350 215 402 200" n={1} cx={338} cy={270} running={running} />
      <Hop d="M565 236 C610 240 612 292 646 288" n={2} cx={612} cy={262} running={running} />
      <Hop d="M816 262 C856 252 850 172 876 164" n={3} cx={850} cy={212} running={running} />

      <Cursor x={790} y={272} />
      <Stopwatch cx={1110} cy={320} r={58} />
    </svg>
  );
}

/** Page footer: a short dashed trail to a flag, and the Wikipedia credit. */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex items-center gap-4 border-t-[3px] border-ink px-5 py-4 sm:px-8">
      <span className="kicker text-muted">Articles from Wikipedia · CC BY-SA</span>
      <svg viewBox="0 0 200 24" className="ml-auto h-5 w-32 shrink-0 sm:w-48" aria-hidden="true">
        <circle cx="6" cy="16" r="5" fill={INK} />
        <path d="M14 16 H170" stroke={INK} strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
        <line x1="182" y1="22" x2="182" y2="2" stroke={INK} strokeWidth="2.5" />
        <rect x="182" y="2" width="16" height="10" fill={INK} />
      </svg>
    </footer>
  );
}
