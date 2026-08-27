export const MAX_PLAYERS = 4;
export const DEFAULT_STACK = 1000;
export const BET_AMOUNTS = [25, 50, 100, 250, 500] as const;
export const STACK_PRESETS = [500, 1000, 2500, 5000] as const;

export type RoomPlayer = {
  id: string;
  name: string;
  stack: number;
  /** Points committed this street. */
  streetBet: number;
  folded: boolean;
};

export type Room = {
  code: string;
  hostId: string;
  round: number;
  pot: number;
  players: RoomPlayer[];
  version: number;
  createdAt: number;
  updatedAt: number;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function createPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatPoints(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function findPlayer(room: Room, playerId: string): RoomPlayer | undefined {
  return room.players.find((p) => p.id === playerId);
}

/** Highest street commitment among players still in (or all — max is the table). */
export function maxStreetBet(room: Room): number {
  let max = 0;
  for (const p of room.players) {
    if (p.streetBet > max) max = p.streetBet;
  }
  return max;
}

/**
 * Chips this player must put in to match the table.
 * Returns 0 when already matched or nothing to call.
 * Caps at remaining stack (all-in call) when short.
 */
export function callAmountFor(room: Room, player: RoomPlayer): number {
  if (player.folded || player.stack <= 0) return 0;
  const table = maxStreetBet(room);
  const need = table - player.streetBet;
  if (need <= 0) return 0;
  return Math.min(need, player.stack);
}

export function publicRoom(room: Room): Room {
  return room;
}
