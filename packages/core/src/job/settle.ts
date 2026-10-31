/** Anything that can take in and send out its mail: a GigDevice. */
export interface Syncs {
  sync(): Promise<{ received: number; sent: number }>;
}

/** Rounds after which settling gives up: a conversation that has not gone quiet by then is looping. */
export const MAX_SETTLE_ROUNDS = 60;

export class SettleError extends Error {}

/**
 * Syncs every device in turn until one whole round moves nothing, as phones that are all online would. Returns the
 * number of rounds it took. For tests and demos; a real phone syncs on a push or a timer.
 */
export async function settle(devices: readonly Syncs[], maxRounds = MAX_SETTLE_ROUNDS): Promise<number> {
  for (let round = 1; round <= maxRounds; round++) {
    let moved = 0;
    // In turn on purpose: each device must see what the previous one sent in this round.
    for (const d of devices) {
      const { received, sent } = await d.sync();
      moved += received + sent;
    }
    if (moved === 0) return round;
  }
  throw new SettleError(`still talking after ${maxRounds} rounds`);
}
