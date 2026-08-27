import { callAmountFor, findPlayer, normalizeCode } from "@/lib/room";
import { RoomError, withRoomLock } from "@/lib/room-store";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/** Match the highest streetBet this round (all-in if short). */
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
      if (player.folded) throw new RoomError("You folded this street", 400);

      const amount = callAmountFor(current, player);
      if (amount <= 0) {
        throw new RoomError("Nothing to call", 400);
      }

      player.stack -= amount;
      player.streetBet += amount;
      current.pot += amount;
      return current;
    });

    return jsonOk({ room });
  } catch (error) {
    return jsonError(error);
  }
}
