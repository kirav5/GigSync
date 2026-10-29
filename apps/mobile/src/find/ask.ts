import { EVERY_DAY, type GigDevice, type NewNeed, type Ports } from "@gigsync/core";
import type { BoardWorker, Place, Trade } from "@gigsync/protocol";
import { type Account, apiClient, rememberName } from "../adapters/account.js";
import type { I18n } from "../i18n.js";
import { dayDate } from "../screens/jobGroups.js";

/**
 * Find's two calls, the same for the form and the chat: search the board near an area, and ask the workers the owner
 * picked. The request itself is built in core (`needToSend`), so both send exactly the same thing.
 */

/** The board's workers for a trade near a place, never the owner's own card (a worker hiring never hires themself). */
export async function searchBoard(
  account: Account,
  trade: Trade,
  at: Place,
  radius_km: number,
): Promise<BoardWorker[]> {
  const board = await apiClient(account.session).searchWorkers({ trade, lat: at.lat, lon: at.lon, radius_km });
  return board.filter((w) => w.user !== account.session.user);
}

/** Sends one need to the picked workers, keeping their names on this phone for My jobs. */
export async function askWorkers(
  ports: Ports,
  device: GigDevice,
  need: NewNeed,
  workers: readonly BoardWorker[],
  picked: readonly string[],
): Promise<void> {
  const chosen = workers.filter((w) => picked.includes(w.user));
  await Promise.all(chosen.map((w) => rememberName(ports, w.user, w.display_name)));
  await device.request(
    need,
    chosen.map((w) => w.user),
  );
}

/**
 * The day as the request's `when` names it: the date itself, never "Today" or "Tomorrow", which are true only on the
 * day they are sent ("कल" is also yesterday); or "Every day".
 */
export const dayLabel = ({ t, date }: Pick<I18n, "t" | "date">, day: string): string =>
  day === EVERY_DAY ? t("when.daily") : date(dayDate(day));
