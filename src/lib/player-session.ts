const KEY_PREFIX = "stack.roomPlayer.";

export function loadRoomPlayerId(code: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${KEY_PREFIX}${code.toUpperCase()}`);
  } catch {
    return null;
  }
}

export function saveRoomPlayerId(code: string, playerId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${KEY_PREFIX}${code.toUpperCase()}`,
      playerId,
    );
  } catch {
    // ignore
  }
}

export function loadDraftName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("stack.draftName") ?? "";
  } catch {
    return "";
  }
}

export function saveDraftName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("stack.draftName", name);
  } catch {
    // ignore
  }
}
