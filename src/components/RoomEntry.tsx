"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { DEFAULT_STACK, STACK_PRESETS, formatPoints } from "@/lib/room";
import {
  loadDraftName,
  saveDraftName,
  saveRoomPlayerId,
} from "@/lib/player-session";

type Props = {
  defaultStack?: number;
};

function subscribeNever() {
  return () => {};
}

function useDraftName() {
  return useSyncExternalStore(subscribeNever, loadDraftName, () => "");
}

type StoreStatus = { ready: boolean; configured: boolean | null };
let storeStatus: StoreStatus = { ready: false, configured: null };
const storeListeners = new Set<() => void>();

function subscribeStore(listener: () => void) {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

function readStoreStatus() {
  return storeStatus;
}

function readStoreServer(): StoreStatus {
  return { ready: false, configured: null };
}

function ensureStoreStatus() {
  if (storeStatus.ready || typeof window === "undefined") return;
  void fetch("/api/rooms")
    .then((r) => r.json())
    .then((d: { configured?: boolean }) => {
      storeStatus = { ready: true, configured: Boolean(d.configured) };
      for (const listener of storeListeners) listener();
    })
    .catch(() => {
      storeStatus = { ready: true, configured: false };
      for (const listener of storeListeners) listener();
    });
}

export function RoomEntry({ defaultStack = DEFAULT_STACK }: Props) {
  const router = useRouter();
  const draftName = useDraftName();
  const status = useSyncExternalStore(
    subscribeStore,
    readStoreStatus,
    readStoreServer,
  );
  ensureStoreStatus();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(draftName);
  const [joinCode, setJoinCode] = useState("");
  const [stack, setStack] = useState(
    defaultStack > 0 ? defaultStack : DEFAULT_STACK,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveDefault = defaultStack > 0 ? defaultStack : DEFAULT_STACK;
  const configured = status.configured;

  async function startRoom() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("First name required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      saveDraftName(trimmed);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, stack }),
      });
      const data = (await res.json()) as {
        error?: string;
        room?: { code: string };
        playerId?: string;
      };
      if (!res.ok || !data.room || !data.playerId) {
        throw new Error(data.error || "Could not start room");
      }
      saveRoomPlayerId(data.room.code, data.playerId);
      router.push(`/r/${data.room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start room");
      setBusy(false);
    }
  }

  function goJoin() {
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 3) {
      setError("Enter the room code");
      return;
    }
    if (name.trim()) saveDraftName(name.trim());
    router.push(`/r/${code}`);
  }

  return (
    <section className="room-entry">
      <button
        type="button"
        className="room-entry-toggle"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && effectiveDefault > 0) setStack(effectiveDefault);
          if (!open && !name && draftName) setName(draftName);
        }}
      >
        {open ? "Hide table room" : "Play with the table"}
      </button>

      {open ? (
        <div className="room-entry-panel">
          <p className="room-entry-copy">
            Host a room, text the code. Buddies join on their phones. Shared pot.
            Sample points only.
          </p>

          {configured === false ? (
            <p className="banner-error">
              Rooms need Redis env on Vercel: STACK_KV_REST_URL +
              STACK_KV_REST_TOKEN. Solo mode still works below.
            </p>
          ) : null}

          <label className="field-label" htmlFor="room-name">
            First name
          </label>
          <input
            id="room-name"
            className="field-input"
            maxLength={16}
            placeholder="e.g. Javier"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <p className="field-label">Starting stack</p>
          <div className="chips chips--tight" role="group">
            {STACK_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`chip ${stack === amount ? "is-selected" : ""}`}
                onClick={() => setStack(amount)}
              >
                {formatPoints(amount)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn--commit btn--win"
            disabled={busy || configured === false}
            onClick={() => void startRoom()}
          >
            Start room
          </button>

          <div className="room-entry-join">
            <label className="field-label" htmlFor="join-code">
              Or join with code
            </label>
            <div className="field-row">
              <input
                id="join-code"
                className="field-input"
                placeholder="ABCD"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  )
                }
                maxLength={6}
              />
              <button
                type="button"
                className="btn btn--signal"
                disabled={busy}
                onClick={goJoin}
              >
                Join
              </button>
            </div>
          </div>

          {error ? <p className="banner-error">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
