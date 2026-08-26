import { RoomError, isRoomStoreConfigured, saveRoom, getRoom } from "@/lib/room-store";
import {
  createPlayerId,
  DEFAULT_STACK,
  generateRoomCode,
  type Room,
} from "@/lib/room";
import { jsonError, jsonOk, parsePositiveInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk({
    configured: isRoomStoreConfigured(),
  });
}

export async function POST(request: Request) {
  try {
    if (!isRoomStoreConfigured()) {
      throw new RoomError(
        "Room store is not configured. Set STACK_KV_REST_URL and STACK_KV_REST_TOKEN.",
        503,
      );
    }

    const body = (await request.json()) as {
      name?: string;
      stack?: number;
    };
    const name = String(body.name ?? "").trim().slice(0, 16);
    if (!name) throw new RoomError("First name required", 400);
    const stack = parsePositiveInt(body.stack) ?? DEFAULT_STACK;
    const hostId = createPlayerId();
    const now = Date.now();

    let code = generateRoomCode();
    for (let i = 0; i < 6; i++) {
      if (!(await getRoom(code))) break;
      code = generateRoomCode();
    }

    const room: Room = {
      code,
      hostId,
      round: 1,
      pot: 0,
      players: [
        {
          id: hostId,
          name,
          stack,
          streetBet: 0,
          folded: false,
        },
      ],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await saveRoom(room);
    return jsonOk({ room, playerId: hostId });
  } catch (error) {
    return jsonError(error);
  }
}
