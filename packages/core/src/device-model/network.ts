/**
 * The Wi-Fi rule for the model download (ADR 0040 amendment): the owner always agrees first, and a download is
 * never started or resumed by itself on mobile data. Browsers say little: Chrome on Android reports the connection's
 * type and the data saver; Safari (every iPhone browser) reports nothing, so there the app asks.
 */

export const Network = {
  /** Wi-Fi or a cable: a download may resume by itself. */
  unmetered: "unmetered",
  /** Mobile data, or the owner asked to save data: never by itself, and the offer says it uses mobile data. */
  metered: "metered",
  /** The browser does not say: ask before resuming, and say it is best on Wi-Fi. */
  unknown: "unknown",
} as const;
export type Network = (typeof Network)[keyof typeof Network];

/** What `navigator.connection` (the Network Information API) says, where it exists. */
export interface ConnectionFacts {
  type?: string;
  saveData?: boolean;
}

/** `NetworkInformation.type` values that cost nothing per byte, and the ones that do. */
const UNMETERED_TYPES: ReadonlySet<string> = new Set(["wifi", "ethernet"]);
const METERED_TYPES: ReadonlySet<string> = new Set(["cellular", "wimax", "bluetooth"]);

export function networkOf(connection: ConnectionFacts | undefined): Network {
  if (!connection) return Network.unknown;
  if (connection.saveData) return Network.metered;
  if (connection.type && METERED_TYPES.has(connection.type)) return Network.metered;
  if (connection.type && UNMETERED_TYPES.has(connection.type)) return Network.unmetered;
  return Network.unknown;
}

/** A download the owner agreed to and that stopped part-way may carry on without a tap only on Wi-Fi. */
export const mayResumeAlone = (network: Network) => network === Network.unmetered;

/**
 * The understanding pack (tens of MB, not the phone model's gigabyte) fetches by itself on Wi-Fi, and on a computer
 * whose browser does not say what the connection is (desktop Chrome, Safari and Firefox never do), which is almost never
 * on mobile data. A phone that does not say (every iPhone browser) still waits for Wi-Fi it can see.
 */
export const mayFetchPackAlone = (network: Network, computer: boolean) =>
  network === Network.unmetered || (network === Network.unknown && computer);
