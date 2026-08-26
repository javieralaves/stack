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
      takeAll?: boolean;
    };
    const playerId = String(body.playerId ?? "");
    if (!playerId) throw new RoomError("Missing player", 400);

    const room = await withRoomLock(code, (current) => {
      const player = findPlayer(current, playerId);
      if (!player) throw new RoomError("You are not at this table", 403);
      if (current.pot <= 0) throw new RoomError("Pot is empty", 400);

      const amount = body.takeAll
        ? current.pot
        : parsePositiveInt(body.amount);
      if (amount === null) throw new RoomError("Collect must be > 0", 400);
      if (amount > current.pot) {
        throw new RoomError("Cannot collect more than the pot", 400);
      }

      current.pot -= amount;
      player.stack += amount;
      return current;
    });

    return jsonOk({ room });
  } catch (error) {
    return jsonError(error);
  }
}
