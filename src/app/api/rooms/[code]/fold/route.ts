import { findPlayer, normalizeCode } from "@/lib/room";
import { RoomError, withRoomLock } from "@/lib/room-store";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { code: raw } = await params;
    const code = normalizeCode(raw);
    const body = (await request.json()) as { playerId?: string };
    const playerId = String(body.playerId ?? "");
    if (!playerId) throw new RoomError("Missing player", 400);

    const room = await withRoomLock(code, (current) => {
      const player = findPlayer(current, playerId);
      if (!player) throw new RoomError("You are not at this table", 403);
      if (player.folded) return current;
      player.folded = true;
      return current;
    });

    return jsonOk({ room });
  } catch (error) {
    return jsonError(error);
  }
}
