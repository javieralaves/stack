import { Redis } from "@upstash/redis";

/**
 * Durable room store env contract (any one pair works):
 *
 * Preferred (clear names for this app):
 *   STACK_KV_REST_URL
 *   STACK_KV_REST_TOKEN
 *
 * Vercel KV / Upstash marketplace defaults also accepted:
 *   KV_REST_API_URL + KV_REST_API_TOKEN
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
export function getKvCredentials(): { url: string; token: string } | null {
  const url =
    process.env.STACK_KV_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.STACK_KV_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function isRoomStoreConfigured(): boolean {
  return getKvCredentials() !== null || isDevMemoryStoreEnabled();
}

/** Single-process memory fallback for local `next dev` / `next start` without Redis. */
export function isDevMemoryStoreEnabled(): boolean {
  return (
    process.env.STACK_ROOM_MEMORY === "1" ||
    (process.env.NODE_ENV !== "production" && getKvCredentials() === null)
  );
}

let redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const creds = getKvCredentials();
  if (!creds) {
    redis = null;
    return null;
  }
  redis = new Redis({ url: creds.url, token: creds.token });
  return redis;
}
