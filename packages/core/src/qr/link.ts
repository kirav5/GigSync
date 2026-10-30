import {
  type BoardProfile,
  type BoardWorker,
  type MyQrRequest,
  type Place,
  QR_NAME_MAX,
  QR_PARAM,
  QrCode,
  type QrRole,
  type UserId,
} from "@gigsync/protocol";
import { distanceKm } from "../job/worker.js";

const WHITESPACE = /\s+/;

/** What a person's QR shows besides a worker's card: their role and their first name, the first word of their name. */
export function qrOwner(name: string, role: QrRole): MyQrRequest {
  const [first = ""] = name.trim().split(WHITESPACE);
  return { role, first_name: first.slice(0, QR_NAME_MAX) };
}

/** Distances are shown to a tenth of a kilometre, as the board shows them. */
const DISTANCE_SCALE = 10;

/** The link a QR carries: the app's address with the code, `<app>/?to=<code>`. */
export function qrLink(appUrl: string, code: QrCode): string {
  const url = new URL(appUrl);
  url.search = new URLSearchParams({ [QR_PARAM]: code }).toString();
  url.hash = "";
  return url.toString();
}

/** The code in a scanned QR's text or an opened link (any address, as the camera hands it over), if it holds one. */
export function codeIn(text: string): QrCode | undefined {
  let found: string | null = null;
  try {
    found = new URL(text.trim()).searchParams.get(QR_PARAM);
  } catch {
    return undefined;
  }
  const code = QrCode.safeParse(found);
  return code.success ? code.data : undefined;
}

/** A scanned worker's card as Find lists a worker, measured from where the household wants the work done. */
export function boardWorkerOf(user: UserId, card: BoardProfile, from: Place): BoardWorker {
  const km = Math.round(distanceKm(from, card.area) * DISTANCE_SCALE) / DISTANCE_SCALE;
  return { ...card, user, distance_km: km };
}
