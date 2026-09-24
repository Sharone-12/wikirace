// Solo games remember recently played starts and targets in this browser so
// the next round avoids them. Starts are kept longer than targets because
// there are about twice as many of them.

const KEY = "wikirace:recent";
const KEEP_STARTS = 150;
const KEEP_TARGETS = 60;

interface Recent {
  starts: string[];
  targets: string[];
}

function load(): Recent {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && Array.isArray(v.starts) && Array.isArray(v.targets)) return v;
  } catch {
    // unreadable or blocked: start fresh
  }
  return { starts: [], targets: [] };
}

/** Everything played recently, starts and targets together. */
export function recentTitles(): string[] {
  const r = load();
  return [...r.starts, ...r.targets];
}

export function rememberRound(start: string, target: string): void {
  const r = load();
  const next: Recent = {
    starts: [start, ...r.starts.filter((s) => s !== start)].slice(0, KEEP_STARTS),
    targets: [target, ...r.targets.filter((t) => t !== target)].slice(0, KEEP_TARGETS),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage blocked: history lasts for this page only.
  }
}
