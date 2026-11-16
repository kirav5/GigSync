/**
 * When the owner last said something in a chat, by typing, voice or a tap (performance.now(); 0 before they have):
 * a reply is written out letter by letter only when it answers words just said (Typed.tsx), never when a chat is
 * opened or come back to.
 */
let saidAt = 0;

/** The owner just added their own turn to a chat. */
export function ownerSaidNow(): void {
  saidAt = performance.now();
}

export const ownerSaidAt = (): number => saidAt;
