import { getRedis, isDevMemoryStoreEnabled, isRoomStoreConfigured } from "@/lib/kv";
import type { Room } from "@/lib/room";

const ROOM_TTL_SECONDS = 60 * 60 * 12; // 12h table night

type MemoryBag = Map<string, Room>;

declare global {
  var __stackRoomMemory: MemoryBag | undefined;
}

function memoryBag(): MemoryBag {
  if (!globalThis.__stackRoomMemory) {
    globalThis.__stackRoomMemory = new Map();
  }
  return globalThis.__stackRoomMemory;
}

function roomKey(code: string): string {
  return `stack:room:${code.toUpperCase()}`;
}

function lockKey(code: string): string {
  return `stack:lock:${code.toUpperCase()}`;
}

export { isRoomStoreConfigured };

export async function getRoom(code: string): Promise<Room | null> {
  const normalized = code.toUpperCase();
  const redis = getRedis();
  if (redis) {
    const room = await redis.get<Room>(roomKey(normalized));
    return room ?? null;
  }
  if (isDevMemoryStoreEnabled()) {
    return memoryBag().get(normalized) ?? null;
  }
  throw storeMissingError();
}

export async function saveRoom(room: Room): Promise<void> {
  const redis = getRedis();
  const payload: Room = {
    ...room,
    code: room.code.toUpperCase(),
    updatedAt: Date.now(),
  };
  if (redis) {
    await redis.set(roomKey(payload.code), payload, { ex: ROOM_TTL_SECONDS });
    return;
  }
  if (isDevMemoryStoreEnabled()) {
    memoryBag().set(payload.code, payload);
    return;
  }
  throw storeMissingError();
}

export async function withRoomLock(
  code: string,
  fn: (room: Room) => Promise<Room> | Room,
): Promise<Room> {
  const normalized = code.toUpperCase();
  const redis = getRedis();

  for (let attempt = 0; attempt < 8; attempt++) {
    if (redis) {
      const locked = await redis.set(lockKey(normalized), "1", {
        nx: true,
        px: 2500,
      });
      if (!locked) {
        await sleep(40 + attempt * 30);
        continue;
      }
      try {
        const current = await getRoom(normalized);
        if (!current) throw new RoomError("Room not found", 404);
        const next = await fn(structuredClone(current));
        next.version = current.version + 1;
        await saveRoom(next);
        return next;
      } finally {
        await redis.del(lockKey(normalized));
      }
    }

    if (isDevMemoryStoreEnabled()) {
      const current = await getRoom(normalized);
      if (!current) throw new RoomError("Room not found", 404);
      const next = await fn(structuredClone(current));
      next.version = current.version + 1;
      await saveRoom(next);
      return next;
    }

    throw storeMissingError();
  }

  throw new RoomError("Table is busy — try again", 409);
}

export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RoomError";
    this.status = status;
  }
}

function storeMissingError(): RoomError {
  return new RoomError(
    "Room store is not configured. Set STACK_KV_REST_URL and STACK_KV_REST_TOKEN (or KV_REST_API_* / UPSTASH_REDIS_REST_*).",
    503,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
