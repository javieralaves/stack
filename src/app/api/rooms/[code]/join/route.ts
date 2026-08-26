import {
  createPlayerId,
  DEFAULT_STACK,
  MAX_PLAYERS,
  normalizeCode,
} from "@/lib/room";
import { RoomError, withRoomLock } from "@/lib/room-store";
import { jsonError, jsonOk, parsePositiveInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { code: raw } = await params;
    const code = normalizeCode(raw);
    if (!code) throw new RoomError("Invalid code", 400);

    const body = (await request.json()) as {
      name?: string;
      stack?: number;
      playerId?: string;
    };
    const name = String(body.name ?? "").trim().slice(0, 16);
    if (!name) throw new RoomError("First name required", 400);
    const stack = parsePositiveInt(body.stack) ?? DEFAULT_STACK;
    const reuseId =
      typeof body.playerId === "string" && body.playerId.length > 8
        ? body.playerId
        : null;

    let playerId = reuseId ?? createPlayerId();

    const room = await withRoomLock(code, (current) => {
      const existing = reuseId
        ? current.players.find((p) => p.id === reuseId)
        : undefined;
      if (existing) {
        existing.name = name;
        playerId = existing.id;
        return current;
      }

      const sameName = current.players.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (sameName) {
        // Reclaim seat by first name on the same phone night.
        playerId = sameName.id;
        return current;
      }

      if (current.players.length >= MAX_PLAYERS) {
        throw new RoomError("Table is full (max 4)", 409);
      }

      current.players.push({
        id: playerId,
        name,
        stack,
        streetBet: 0,
        folded: false,
      });
      return current;
    });

    return jsonOk({ room, playerId });
  } catch (error) {
    return jsonError(error);
  }
}
