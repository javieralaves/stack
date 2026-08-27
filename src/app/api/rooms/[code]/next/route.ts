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
      if (current.pot > 0) {
        throw new RoomError("Winner should Collect the pot first", 400);
      }

      current.round += 1;
      current.pot = 0;
      for (const p of current.players) {
        p.streetBet = 0;
        p.folded = false;
      }
      return current;
    });

    return jsonOk({ room });
  } catch (error) {
    return jsonError(error);
  }
}
