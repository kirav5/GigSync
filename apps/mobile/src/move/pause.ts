/**
 * Whether the mailbox is left alone for now. The old phone stops syncing once it has packed its records for a move:
 * whatever arrives after that stays in the mailbox for the new phone, instead of landing on a phone about to be signed
 * out, after the package was made.
 */
let paused = false;

export function pauseSync(on: boolean): void {
  paused = on;
}

export const syncPaused = (): boolean => paused;
