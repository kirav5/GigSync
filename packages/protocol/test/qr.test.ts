import { describe, expect, it } from "vitest";
import {
  BODY,
  EnvelopeKind,
  MyQrRequest,
  QR_KINDS,
  QrCode,
  QrPerson,
  QrRole,
  SIDE_CHANNEL_KINDS,
  WorkOffer,
} from "../src/index.js";

const USER = "usr_01J0000000000000000000AAAA";
const card = {
  display_name: "Meena",
  trades: ["cook"],
  area: { lat: 12.97, lon: 77.64 },
  area_name: "Indiranagar",
  rate_paise: 900000,
};

describe("personal QR", () => {
  it("takes only a 12-character base64url code", () => {
    expect(QrCode.safeParse("abcDEF012_-x").success).toBe(true);
    expect(QrCode.safeParse("abcDEF012_-").success).toBe(false);
    expect(QrCode.safeParse("abcDEF012_-x1").success).toBe(false);
    expect(QrCode.safeParse("abcDEF012+/x").success).toBe(false);
  });

  it("trims the first name and refuses an empty one", () => {
    expect(MyQrRequest.parse({ role: QrRole.enum.household, first_name: "  Priya " }).first_name).toBe("Priya");
    expect(MyQrRequest.safeParse({ role: QrRole.enum.household, first_name: "   " }).success).toBe(false);
    expect(MyQrRequest.safeParse({ role: "admin", first_name: "Priya" }).success).toBe(false);
  });

  it("shows a household's first name only, and a worker's card or none", () => {
    const home = QrPerson.parse({ role: QrRole.enum.household, user: USER, first_name: "Priya", card });
    expect(home).toEqual({ role: QrRole.enum.household, user: USER, first_name: "Priya" });
    const worker = QrPerson.parse({ role: QrRole.enum.worker, user: USER, first_name: "Meena", card });
    expect(worker.role === QrRole.enum.worker && worker.card?.languages).toEqual([]);
    expect(QrPerson.safeParse({ role: QrRole.enum.worker, user: USER, first_name: "Meena", card: null }).success).toBe(
      true,
    );
  });

  it("carries an offer to work outside any job, with a card the board would take", () => {
    const k = EnvelopeKind.enum.work_offer;
    expect(QR_KINDS.has(k)).toBe(true);
    expect(SIDE_CHANNEL_KINDS.has(k)).toBe(false);
    expect(BODY[k]).toBe(WorkOffer);
    expect(WorkOffer.safeParse({ card: { ...card, trades: [] } }).success).toBe(false);
    expect(WorkOffer.safeParse({ card }).success).toBe(true);
  });
});
