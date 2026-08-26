import { normalizeCode } from "@/lib/room";
import { getRoom, RoomError } from "@/lib/room-store";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code: raw } = await params;
    const code = normalizeCode(raw);
    if (!code) throw new RoomError("Invalid code", 400);
    const room = await getRoom(code);
    if (!room) throw new RoomError("Room not found", 404);
    return jsonOk({ room });
  } catch (error) {
    return jsonError(error);
  }
}
