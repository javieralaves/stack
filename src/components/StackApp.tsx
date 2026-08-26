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
  const [flash, setFlash] = useState<"bet" | "collect" | "set" | null>(null);
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

  function pulse(kind: "bet" | "collect" | "set") {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(kind);
    setTick((t) => t + 1);
    flashTimer.current = setTimeout(() => setFlash(null), 420);
  }

  function setStack(amount: number) {
    const next = Math.max(0, Math.floor(amount));
    patchState({
      stack: next,
      started: true,
      selectedBet: Math.min(
        memoryState.selectedBet || 100,
        Math.max(25, next || 100),
      ),
    });
    pulse("set");
    setEditingSetup(false);
  }

  function selectAmount(amount: number) {
    patchState({ selectedBet: amount });
  }

  function commitBet() {
    if (state.stack <= 0 || state.selectedBet <= 0) return;
    const bet = Math.min(state.selectedBet, state.stack);
    if (bet <= 0) return;
    patchState({
      stack: state.stack - bet,
      lastBet: bet,
    });
    pulse("bet");
  }

  function collectWin() {
    if (state.selectedBet <= 0) return;
    const amount = Math.max(1, state.selectedBet);
    patchState({ stack: state.stack + amount });
    pulse("collect");
  }

  function goAllIn() {
    if (state.stack <= 0) return;
    patchState({ selectedBet: state.stack });
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
            Javier &amp; friends — set tonight&apos;s points. Sample points only.
            No money. Phones face-up on the table.
          </p>
        </header>

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
            const n = Math.floor(Number(customStack.replace(/,/g, "")));
            if (!Number.isFinite(n) || n <= 0) return;
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
  const primaryLabel =
    mode === "bet"
      ? state.stack <= 0
        ? "Busted"
        : `Commit ${formatPoints(betAmount)}`
      : `Collect ${formatPoints(state.selectedBet)}`;

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
        <p className="lede lede--tight">
          Points for the table tonight. Sample only — no real money.
        </p>
      </header>

      <section className="scoreboard" aria-live="polite">
        <p className="score-label">Your stack</p>
        <p key={tick} className="score-value">
          {formatPoints(state.stack)}
        </p>
        <p className="score-meta">
          Last bet{" "}
          <span className="score-meta-num">
            {state.lastBet > 0 ? formatPoints(state.lastBet) : "—"}
          </span>
        </p>
      </section>

      <div className="mode-row" role="tablist" aria-label="Action mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "bet"}
          className={`mode-btn ${mode === "bet" ? "is-on" : ""}`}
          onClick={() => setMode("bet")}
        >
          Bet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "collect"}
          className={`mode-btn ${mode === "collect" ? "is-on" : ""}`}
          onClick={() => setMode("collect")}
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
            className={`chip chip--all ${state.selectedBet === state.lastBet && state.lastBet > 0 ? "is-selected" : ""}`}
            onClick={() => state.lastBet > 0 && selectAmount(state.lastBet)}
            disabled={state.lastBet <= 0}
          >
            Last
          </button>
        )}
      </div>

      <button
        type="button"
        className={`btn btn--commit ${mode === "collect" ? "btn--win" : ""}`}
        onClick={mode === "bet" ? commitBet : collectWin}
        disabled={mode === "bet" ? !canBet : state.selectedBet <= 0}
      >
        {primaryLabel}
      </button>
    </div>
  );
}
