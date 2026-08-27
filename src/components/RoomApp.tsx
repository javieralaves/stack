"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BET_AMOUNTS,
  callAmountFor,
  DEFAULT_STACK,
  formatPoints,
  maxStreetBet,
  STACK_PRESETS,
  type Room,
  type RoomPlayer,
} from "@/lib/room";
import {
  loadDraftName,
  loadRoomPlayerId,
  saveDraftName,
  saveRoomPlayerId,
} from "@/lib/player-session";
import { HandRankingsButton } from "@/components/HandRankingsSheet";

function parsePositiveInt(raw: string): number | null {
  const n = Math.floor(Number(raw.replace(/,/g, "")));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Target total streetBet options for open/raise (includes all-in total). */
function raiseToOptions(
  tableBet: number,
  streetBet: number,
  stack: number,
): number[] {
  const maxTo = streetBet + stack;
  if (stack <= 0 || maxTo <= streetBet) return [];
  const candidates = new Set<number>();
  for (const amount of BET_AMOUNTS) {
    if (tableBet === 0) {
      if (amount <= maxTo) candidates.add(amount);
    } else if (amount > tableBet && amount <= maxTo) {
      candidates.add(amount);
    }
  }
  if (tableBet > 0) {
    const doubled = tableBet * 2;
    if (doubled > tableBet && doubled <= maxTo) candidates.add(doubled);
  }
  if (maxTo > tableBet || (tableBet === 0 && maxTo > 0)) {
    candidates.add(maxTo);
  }
  return [...candidates].sort((a, b) => a - b);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

const boot = {
  code: "",
  name: "",
  playerId: null as string | null,
  ready: false,
};
const bootListeners = new Set<() => void>();

function subscribeBoot(listener: () => void) {
  bootListeners.add(listener);
  return () => bootListeners.delete(listener);
}

function emitBoot() {
  for (const listener of bootListeners) listener();
}

function readBoot() {
  return boot;
}

function readBootServer() {
  return {
    code: "",
    name: "",
    playerId: null as string | null,
    ready: false,
  };
}

function hydrateBoot(code: string) {
  if (boot.ready && boot.code === code) return;
  boot.code = code;
  boot.name = loadDraftName();
  boot.playerId = loadRoomPlayerId(code);
  boot.ready = true;
  emitBoot();
}

export function RoomApp({ code }: { code: string }) {
  const roomCode = code.toUpperCase();
  const session = useSyncExternalStore(subscribeBoot, readBoot, readBootServer);
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stackChoice, setStackChoice] = useState(DEFAULT_STACK);
  const [customStack, setCustomStack] = useState("");
  const [raiseTo, setRaiseTo] = useState(100);
  const [customRaise, setCustomRaise] = useState("");
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const syncedCode = useRef<string | null>(null);

  useEffect(() => {
    hydrateBoot(roomCode);
  }, [roomCode]);

  useEffect(() => {
    if (!session.ready || session.code !== roomCode) return;
    if (syncedCode.current === roomCode) return;
    syncedCode.current = roomCode;
    queueMicrotask(() => {
      setName(session.name);
      setPlayerId(session.playerId);
    });
  }, [session, roomCode]);

  const me: RoomPlayer | undefined = useMemo(
    () => room?.players.find((p) => p.id === playerId),
    [room, playerId],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ room: Room }>(`/api/rooms/${roomCode}`);
      setRoom(data.room);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load room");
    }
  }, [roomCode]);

  useEffect(() => {
    if (!session.ready) return;
    const kick = window.setTimeout(() => {
      void refresh();
    }, 0);
    const id = window.setInterval(() => {
      void refresh();
    }, 1500);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [session.ready, refresh]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${roomCode}`
      : `/r/${roomCode}`;

  async function join() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your first name");
      return;
    }
    const stack = parsePositiveInt(customStack) ?? stackChoice;
    setBusy(true);
    setError(null);
    try {
      saveDraftName(trimmed);
      const data = await api<{ room: Room; playerId: string }>(
        `/api/rooms/${roomCode}/join`,
        {
          method: "POST",
          body: JSON.stringify({
            name: trimmed,
            stack,
            playerId: playerId ?? undefined,
          }),
        },
      );
      saveRoomPlayerId(roomCode, data.playerId);
      setPlayerId(data.playerId);
      setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  }

  async function act(
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<void> {
    if (!playerId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ room: Room }>(`/api/rooms/${roomCode}/${path}`, {
        method: "POST",
        body: JSON.stringify({ playerId, ...body }),
      });
      setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(
        `Join my Stack table: ${shareUrl} (code ${roomCode})`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy — share the URL manually");
    }
  }

  if (!session.ready) {
    return (
      <div className="slab slab--boot" aria-busy="true">
        <p className="brand">STACK</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="slab slab--setup">
        <header className="slab-head">
          <p className="brand">STACK</p>
          <p className="round-line">
            <span className="round-num">Room {roomCode}</span>
          </p>
          <p className="lede">Loading the table…</p>
          {error ? <p className="banner-error">{error}</p> : null}
        </header>
        <Link href="/" className="linkish">
          Solo mode
        </Link>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="slab slab--setup">
        <header className="slab-head">
          <p className="brand">STACK</p>
          <p className="round-line">
            <span className="round-num">Room {roomCode}</span>
          </p>
          <p className="lede">
            Javier &amp; friends — pick your first name and starting stack.
            Sample points only.
          </p>
        </header>

        <label className="field-label" htmlFor="join-name">
          First name
        </label>
        <input
          id="join-name"
          className="field-input"
          value={name}
          maxLength={16}
          placeholder="e.g. Javier"
          onChange={(e) => setName(e.target.value)}
        />

        <p className="field-label">Starting stack</p>
        <div className="setup-presets setup-presets--compact" role="group">
          {STACK_PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={`chip chip--xl ${stackChoice === amount && !customStack ? "is-selected" : ""}`}
              onClick={() => {
                setStackChoice(amount);
                setCustomStack("");
              }}
            >
              {formatPoints(amount)}
            </button>
          ))}
        </div>
        <div className="field-row">
          <input
            className="field-input"
            inputMode="numeric"
            placeholder="Custom"
            value={customStack}
            onChange={(e) => setCustomStack(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>

        {error ? <p className="banner-error">{error}</p> : null}

        <button
          type="button"
          className="btn btn--commit btn--win"
          disabled={busy || !name.trim()}
          onClick={() => void join()}
        >
          Sit down
        </button>
        <Link href="/" className="linkish">
          Solo mode
        </Link>
      </div>
    );
  }

  const canCollect = room.pot > 0;
  const tableBet = maxStreetBet(room);
  const callAmount = callAmountFor(room, me);
  const canCall = callAmount > 0;
  const callIsAllIn =
    canCall && callAmount === me.stack && me.streetBet + callAmount < tableBet;
  const callLabel = !canCall
    ? me.folded
      ? "Folded"
      : tableBet <= 0 || me.streetBet >= tableBet
        ? "Matched"
        : "Call"
    : callIsAllIn
      ? `Call ${formatPoints(callAmount)} · all in`
      : `Call ${formatPoints(callAmount)}`;

  const raiseOptions = raiseToOptions(tableBet, me.streetBet, me.stack);
  const opening = tableBet === 0;
  const effectiveRaiseTo =
    parsePositiveInt(customRaise) ??
    (raiseTo > 0 ? raiseTo : raiseOptions[0] ?? 0);
  const raisePutIn = Math.max(0, effectiveRaiseTo - me.streetBet);
  const raiseChips = Math.min(raisePutIn, me.stack);
  const canRaise =
    !me.folded &&
    me.stack > 0 &&
    raiseChips > 0 &&
    (opening
      ? effectiveRaiseTo > 0
      : effectiveRaiseTo > tableBet || raiseChips === me.stack);
  const raiseIsAllIn = canRaise && raiseChips === me.stack;
  const raiseConfirmLabel = opening
    ? raiseIsAllIn
      ? `Bet ${formatPoints(raiseChips)} · all in`
      : `Bet ${formatPoints(raiseChips)}`
    : raiseIsAllIn && me.streetBet + raiseChips <= tableBet
      ? `All in ${formatPoints(raiseChips)}`
      : raiseIsAllIn
        ? `Raise to ${formatPoints(me.streetBet + raiseChips)} · all in`
        : `Raise to ${formatPoints(effectiveRaiseTo)}`;

  const myStreetBet = me.streetBet;
  const myStack = me.stack;

  function openRaise() {
    const nextOpen = !raiseOpen;
    setRaiseOpen(nextOpen);
    if (nextOpen) {
      const options = raiseToOptions(tableBet, myStreetBet, myStack);
      const preferred =
        options.find((a) => a > tableBet) ?? options[options.length - 1] ?? 0;
      setRaiseTo(preferred);
      setCustomRaise("");
    }
  }

  return (
    <div className="slab slab--play">
      <header className="slab-head slab-head--play">
        <div className="brand-row">
          <p className="brand">STACK</p>
          <Link href="/" className="linkish">
            Solo
          </Link>
        </div>
        <div className="round-line-row">
          <p className="round-line">
            <span className="round-num">Round {room.round}</span>
            <span className="round-sep" aria-hidden="true">
              ·
            </span>
            <span className="round-street">room {roomCode}</span>
          </p>
          <HandRankingsButton />
        </div>
        <div className="share-row">
          <button
            type="button"
            className="btn btn--share"
            onClick={() => void copyShare()}
          >
            {copied ? "Copied" : "Copy invite"}
          </button>
          <span className="share-url">{shareUrl.replace(/^https?:\/\//, "")}</span>
        </div>
      </header>

      <section className="scoreboard scoreboard--room" aria-live="polite">
        <div className="pot-head">
          <p className="score-label">Common pot</p>
          <button
            type="button"
            className="btn btn--pot-collect"
            disabled={busy || !canCollect}
            onClick={() => void act("collect")}
          >
            Collect
          </button>
        </div>
        <p className="score-value score-value--pot">{formatPoints(room.pot)}</p>
        <div className="score-meta-row">
          <p className="score-meta score-meta--emph">
            Your stack{" "}
            <span className="score-meta-num score-meta-num--citrus">
              {formatPoints(me.stack)}
            </span>
          </p>
          <p className="score-meta">
            This street{" "}
            <span className="score-meta-num">{formatPoints(me.streetBet)}</span>
          </p>
        </div>
      </section>

      <ul className="seat-list" aria-label="Seats">
        {room.players.map((p) => (
          <li
            key={p.id}
            className={`seat ${p.id === me.id ? "is-me" : ""} ${p.folded ? "is-folded" : ""}`}
          >
            <span className="seat-name">
              {p.name}
              {p.id === me.id ? " (you)" : ""}
              {p.folded ? " · folded" : ""}
            </span>
            <span className="seat-stack">{formatPoints(p.stack)}</span>
            <span className="seat-bet">in {formatPoints(p.streetBet)}</span>
          </li>
        ))}
      </ul>

      {error ? <p className="banner-error">{error}</p> : null}

      <div className="action-stack">
        <button
          type="button"
          className="btn btn--call"
          disabled={busy || !canCall}
          onClick={() => {
            setRaiseOpen(false);
            void act("call");
          }}
        >
          {callLabel}
        </button>

        <button
          type="button"
          className={`btn btn--raise ${raiseOpen ? "is-on" : ""}`}
          disabled={busy || me.folded || me.stack <= 0}
          onClick={openRaise}
        >
          {opening ? "Bet" : "Raise"}
        </button>

        {raiseOpen ? (
          <div className="raise-panel">
            <p className="field-label">
              {opening
                ? "Bet — open this street"
                : "Raise to — your total this street"}
            </p>
            <div className="chips" role="group" aria-label="Raise sizes">
              {raiseOptions.map((amount) => {
                const isAllIn = amount === me.streetBet + me.stack;
                const selected =
                  !customRaise && raiseTo === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    className={`chip ${isAllIn ? "chip--all" : ""} ${selected ? "is-selected" : ""}`}
                    onClick={() => {
                      setRaiseTo(amount);
                      setCustomRaise("");
                    }}
                  >
                    {isAllIn ? "All in" : formatPoints(amount)}
                  </button>
                );
              })}
            </div>

            <form
              className="raise-custom"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canRaise) return;
                setRaiseOpen(false);
                void act("bet", { amount: raiseChips });
              }}
            >
              <label className="field-label" htmlFor="custom-raise">
                {opening ? "Custom bet" : "Custom raise to"}
              </label>
              <div className="field-row">
                <input
                  id="custom-raise"
                  className="field-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={opening ? "e.g. 75" : `over ${formatPoints(tableBet)}`}
                  value={customRaise}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "");
                    setCustomRaise(digits);
                    const n = parsePositiveInt(digits);
                    if (n !== null) setRaiseTo(n);
                  }}
                />
              </div>
              {tableBet > 0 && effectiveRaiseTo > 0 ? (
                <p className="raise-hint">
                  Put in {formatPoints(raiseChips)}
                  {raiseChips > 0
                    ? ` → street total ${formatPoints(me.streetBet + raiseChips)}`
                    : ""}
                </p>
              ) : null}
              <button
                type="submit"
                className="btn btn--commit"
                disabled={busy || !canRaise}
              >
                {raiseConfirmLabel}
              </button>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn--fold"
          disabled={busy || me.folded}
          onClick={() => {
            setRaiseOpen(false);
            void act("fold");
          }}
        >
          Fold
        </button>

        <button
          type="button"
          className="btn btn--next"
          disabled={busy || room.pot > 0}
          onClick={() => void act("next")}
        >
          Next round
        </button>
        <p className="next-hint">
          {room.pot > 0
            ? "Winner taps Collect on the pot — takes it and starts the next round."
            : "Empty pot — advance the street. Stacks stay."}
        </p>
      </div>
    </div>
  );
}
