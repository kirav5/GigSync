import { useSyncExternalStore } from "react";

/**
 * Whether the menu is open as a drawer over the screen (phones; on a wide screen it always stands beside the content).
 * Kept outside any component, so Back (Android's button, the browser's) can close it first from App's one listener.
 */
let open = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const drawerOpen = (): boolean => open;

export function setDrawer(next: boolean): void {
  if (next === open) return;
  open = next;
  for (const listener of listeners) listener();
}

export function useDrawer(): boolean {
  return useSyncExternalStore(subscribe, drawerOpen);
}
