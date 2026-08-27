"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BET_AMOUNTS,
  DEFAULT_STATE,
  formatPoints,
  loadState,
  saveState,
  STACK_PRESETS,
  type StackState,
} from "@/lib/storage";
import { RoomEntry } from "@/components/RoomEntry";
import { HandRankingsButton } from "@/components/HandRankingsSheet";

type Mode = "bet" | "collect";

let memoryState: StackState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot(): StackState {
  return memoryState;
}

function getServerSnapshot(): StackState {
  return DEFAULT_STATE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function replaceState(next: StackState) {
  memoryState = next;
  saveState(next);
  emit();
}

function patchState(partial: Partial<StackState>) {
  replaceState({ ...memoryState, ...partial });
}

function hydrateFromStorage() {
  memoryState = loadState();
  emit();
}

const hydration = { ready: false };
const hydrationListeners = new Set<() => void>();

function subscribeHydration(listener: () => void): () => void {
  hydrationListeners.add(listener);
  return () => hydrationListeners.delete(listener);
}

function getHydrationSnapshot() {
  return hydration.ready;
}

function getHydrationServerSnapshot() {
  return false;
}

function markHydrated() {
  if (hydration.ready) return;
  hydration.ready = true;
  for (const listener of hydrationListeners) listener();
}

function parsePositiveInt(raw: string): number | null {
  const n = Math.floor(Number(raw.replace(/,/g, "")));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function StackApp() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getHydrationServerSnapshot,
  );
  const [mode, setMode] = useState<Mode>("bet");
  const [editingSetup, setEditingSetup] = useState(false);
  const [customStack, setCustomStack] = useState("");
  const [customCollect, setCustomCollect] = useState("");
  const [flash, setFlash] = useState<"bet" | "collect" | "set" | "round" | null>(
    null,
  );
  const [tick, setTick] = useState(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hydrateFromStorage();
    markHydrated();
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function pulse(kind: "bet" | "collect" | "set" | "round") {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(kind);
    setTick((t) => t + 1);
    flashTimer.current = setTimeout(() => setFlash(null), 420);
  }

  function setStack(amount: number) {
    const next = Math.max(0, Math.floor(amount));
    const firstNight = !memoryState.started;
    patchState({
      stack: next,
      started: true,
      selectedBet: Math.min(
        memoryState.selectedBet || 100,
        Math.max(25, next || 100),
      ),
      ...(firstNight
        ? { round: 1, roundBet: 0, lastBet: 0 }
        : {}),
    });
    pulse("set");
    setEditingSetup(false);
  }

  function selectAmount(amount: number) {
    patchState({ selectedBet: amount });
    if (mode === "collect") {
      setCustomCollect(amount > 0 ? String(amount) : "");
    }
  }

  function commitBet() {
    if (state.stack <= 0 || state.selectedBet <= 0) return;
    const bet = Math.min(state.selectedBet, state.stack);
    if (bet <= 0) return;
    patchState({
      stack: state.stack - bet,
      lastBet: bet,
      roundBet: state.roundBet + bet,
    });
    pulse("bet");
  }

  function collectWin(amount: number) {
    if (amount <= 0) return;
    patchState({
      stack: state.stack + amount,
      selectedBet: amount,
    });
    setCustomCollect(String(amount));
    pulse("collect");
  }

  function goAllIn() {
    if (state.stack <= 0) return;
    patchState({ selectedBet: state.stack });
  }

  function nextRound() {
    patchState({
      round: state.round + 1,
      roundBet: 0,
    });
    setMode("bet");
    setCustomCollect("");
    pulse("round");
  }

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "collect" && state.roundBet > 0) {
      patchState({ selectedBet: state.roundBet });
      setCustomCollect(String(state.roundBet));
    }
  }

  if (!hydrated) {
    return (
      <div className="slab slab--boot" aria-busy="true">
        <p className="brand">STACK</p>
      </div>
    );
  }

  const showSetup = editingSetup || !state.started;

  if (showSetup) {
    return (
      <div className="slab slab--setup">
        <header className="slab-head">
          <p className="brand">STACK</p>
          <p className="lede">
            Javier &amp; friends — solo on this phone, or open a shared room for
            the table. Sample points only. No money.
          </p>
        </header>

        <RoomEntry defaultStack={state.stack || 1000} />

        <p className="field-label">Solo stack</p>

        <div className="setup-presets" role="group" aria-label="Stack presets">
          {STACK_PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              className="chip chip--xl"
              onClick={() => setStack(amount)}
            >
              {formatPoints(amount)}
            </button>
          ))}
        </div>

        <form
          className="setup-custom"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parsePositiveInt(customStack);
            if (n === null) return;
            setStack(n);
          }}
        >
          <label className="field-label" htmlFor="custom-stack">
            Custom stack
          </label>
          <div className="field-row">
            <input
              id="custom-stack"
              inputMode="numeric"
              pattern="[0-9]*"
              className="field-input"
              placeholder="e.g. 1500"
              value={customStack}
              onChange={(e) => setCustomStack(e.target.value.replace(/[^\d]/g, ""))}
            />
            <button type="submit" className="btn btn--signal" disabled={!customStack}>
              Set
            </button>
          </div>
        </form>

        {state.started ? (
          <button
            type="button"
            className="linkish"
            onClick={() => setEditingSetup(false)}
          >
            Back to table
          </button>
        ) : null}
      </div>
    );
  }

  const canBet = state.stack > 0 && state.selectedBet > 0;
  const betAmount = Math.min(state.selectedBet, state.stack);
  const collectAmount =
    mode === "collect"
      ? parsePositiveInt(customCollect) ??
        (state.selectedBet > 0 ? state.selectedBet : null)
      : null;
  const canCollect = collectAmount !== null && collectAmount > 0;
  const primaryLabel =
    mode === "bet"
      ? state.stack <= 0
        ? "Busted"
        : `Commit ${formatPoints(betAmount)}`
      : canCollect
        ? `Collect ${formatPoints(collectAmount)}`
        : "Collect";

  return (
    <div
      className={`slab slab--play ${flash ? `is-flash-${flash}` : ""}`}
      data-tick={tick}
    >
      <header className="slab-head slab-head--play">
        <div className="brand-row">
          <p className="brand">STACK</p>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setCustomStack(state.stack ? String(state.stack) : "");
              setEditingSetup(true);
            }}
          >
            Set stack
          </button>
        </div>
        <div className="round-line-row">
          <p className="round-line" aria-live="polite">
            <span className="round-num">Round {state.round}</span>
            <span className="round-sep" aria-hidden="true">
              ·
            </span>
            <span className="round-street">this street</span>
          </p>
          <HandRankingsButton />
        </div>
        <p className="lede lede--tight">
          Solo phone. Bet each street. Or open a table room to share one pot.
          Sample only — no real money.
        </p>
        <RoomEntry defaultStack={state.stack || 1000} />
      </header>

      <section className="scoreboard" aria-live="polite">
        <p className="score-label">Your stack</p>
        <p key={tick} className="score-value">
          {formatPoints(state.stack)}
        </p>
        <div className="score-meta-row">
          <p className="score-meta score-meta--emph">
            This round{" "}
            <span className="score-meta-num score-meta-num--citrus">
              {formatPoints(state.roundBet)}
            </span>
          </p>
          <p className="score-meta">
            Last bet{" "}
            <span className="score-meta-num">
              {state.lastBet > 0 ? formatPoints(state.lastBet) : "—"}
            </span>
          </p>
        </div>
      </section>

      <div className="mode-row" role="tablist" aria-label="Action mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "bet"}
          className={`mode-btn ${mode === "bet" ? "is-on" : ""}`}
          onClick={() => switchMode("bet")}
        >
          Bet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "collect"}
          className={`mode-btn ${mode === "collect" ? "is-on" : ""}`}
          onClick={() => switchMode("collect")}
        >
          Collect
        </button>
      </div>

      <div className="chips" role="group" aria-label="Amounts">
        {BET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`chip ${state.selectedBet === amount ? "is-selected" : ""}`}
            onClick={() => selectAmount(amount)}
          >
            {formatPoints(amount)}
          </button>
        ))}
        {mode === "bet" ? (
          <button
            type="button"
            className={`chip chip--all ${state.selectedBet === state.stack && state.stack > 0 ? "is-selected" : ""}`}
            onClick={goAllIn}
            disabled={state.stack <= 0}
          >
            All in
          </button>
        ) : (
          <button
            type="button"
            className={`chip chip--all ${state.selectedBet === state.roundBet && state.roundBet > 0 ? "is-selected" : ""}`}
            onClick={() => state.roundBet > 0 && selectAmount(state.roundBet)}
            disabled={state.roundBet <= 0}
          >
            Round
          </button>
        )}
      </div>

      {mode === "collect" ? (
        <form
          className="collect-custom"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parsePositiveInt(customCollect);
            if (n === null) return;
            collectWin(n);
          }}
        >
          <label className="field-label" htmlFor="custom-collect">
            Custom collect
          </label>
          <div className="field-row">
            <input
              id="custom-collect"
              inputMode="numeric"
              pattern="[0-9]*"
              className="field-input"
              placeholder="e.g. pot total"
              value={customCollect}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "");
                setCustomCollect(digits);
                const n = parsePositiveInt(digits);
                if (n !== null) {
                  patchState({ selectedBet: n });
                }
              }}
            />
            <button
              type="submit"
              className="btn btn--signal btn--win-signal"
              disabled={!canCollect}
            >
              Add
            </button>
          </div>
        </form>
      ) : null}

      <div className="action-stack">
        <button
          type="button"
          className={`btn btn--commit ${mode === "collect" ? "btn--win" : ""}`}
          onClick={() => {
            if (mode === "bet") {
              commitBet();
              return;
            }
            if (collectAmount !== null) collectWin(collectAmount);
          }}
          disabled={mode === "bet" ? !canBet : !canCollect}
        >
          {primaryLabel}
        </button>

        <button
          type="button"
          className="btn btn--next"
          onClick={nextRound}
        >
          Next round
        </button>
        <p className="next-hint">
          After collect or fold — clears this-round bets. Stack stays.
        </p>
      </div>
    </div>
  );
}
