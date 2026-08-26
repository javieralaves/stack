export const STORAGE_KEY = "stack.v1";

export type StackState = {
  /** Current points on this phone. Demo/sample points only. */
  stack: number;
  /** Last committed bet amount. */
  lastBet: number;
  /** Currently selected bet/collect amount. */
  selectedBet: number;
  /** True after the night's stack has been set at least once. */
  started: boolean;
};

export const DEFAULT_STATE: StackState = {
  stack: 0,
  lastBet: 0,
  selectedBet: 100,
  started: false,
};

export const STACK_PRESETS = [500, 1000, 2500, 5000] as const;
export const BET_AMOUNTS = [25, 50, 100, 250, 500] as const;

export function loadState(): StackState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<StackState>;
    const stack = floorNonNeg(Number(parsed.stack));
    return {
      stack,
      lastBet: floorNonNeg(Number(parsed.lastBet)),
      selectedBet: Math.max(1, floorNonNeg(Number(parsed.selectedBet)) || 100),
      started: Boolean(parsed.started),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: StackState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — UI still works for the session.
  }
}

function floorNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function formatPoints(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
