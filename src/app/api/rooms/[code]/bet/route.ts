import { findPlayer, normalizeCode } from "@/lib/room";
import { RoomError, withRoomLock } from "@/lib/room-store";
import { jsonError, jsonOk, parsePositiveInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { code: raw } = await params;
    const code = normalizeCode(raw);
    const body = (await request.json()) as {
      playerId?: string;
      amount?: number;
    };
    const playerId = String(body.playerId ?? "");
    const amount = parsePositiveInt(body.amount);
    if (!playerId) throw new RoomError("Missing player", 400);
    if (amount === null) throw new RoomError("Bet must be > 0", 400);

    const room = await withRoomLock(code, (current) => {
      const player = findPlayer(current, playerId);
      if (!player) throw new RoomError("You are not at this table", 403);
      if (player.folded) throw new RoomError("You folded this street", 400);
      if (player.stack < amount) throw new RoomError("Not enough stack", 400);

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
