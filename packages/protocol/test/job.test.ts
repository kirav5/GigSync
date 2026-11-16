import { describe, expect, it } from "vitest";
import {
  BODY,
  BoardProfile,
  BoardQuery,
  EnvelopeKind,
  JobRequest,
  MAX_CIPHERTEXT_CHARS,
  MAX_PHOTOS,
  MAX_ROUNDS,
  Offer,
  PHOTO_MAX_CHARS,
  PHOTO_PREFIX,
} from "../src/index.js";

const ULID = "01J0000000000000000000AAAA";
const area = { lat: 12.97, lon: 77.64 };

describe("job bodies", () => {
  it("every envelope kind has a body schema", () => {
    for (const k of EnvelopeKind.options) expect(BODY[k]).toBeDefined();
  });
  it("a request carries the need but no budget", () => {
    const req = JobRequest.parse({ trade: "electrician", need: "Fan dead", when: "tomorrow 10am", area, budget: 900 });
    expect(req.details).toEqual({});
    expect("budget" in req).toBe(false);
  });
  it("rejects an unknown trade and an offer past the round limit", () => {
    expect(JobRequest.safeParse({ trade: "astronaut", need: "x", when: "now", area }).success).toBe(false);
    const offer = { offer_id: `off_${ULID}`, round: MAX_ROUNDS + 1, price_paise: 50000, slot: "10am", scope: "fan" };
    expect(Offer.safeParse(offer).success).toBe(false);
  });
});

describe("photos in a request (ADR 0066)", () => {
  const request = { trade: "carpenter", need: "The cupboard door has come off", when: "tomorrow 10am", area };
  /** A JPEG data URL of exactly `chars` characters. */
  const photo = (chars: number) => PHOTO_PREFIX + "A".repeat(chars - PHOTO_PREFIX.length);

  it("carries up to two JPEG photos, each within the size cap", () => {
    const two = Array.from({ length: MAX_PHOTOS }, () => photo(PHOTO_MAX_CHARS));
    expect(JobRequest.parse({ ...request, photos: two }).photos).toHaveLength(MAX_PHOTOS);
    expect(JobRequest.safeParse({ ...request, photos: [...two, photo(100)] }).success).toBe(false);
    expect(JobRequest.safeParse({ ...request, photos: [photo(PHOTO_MAX_CHARS + 1)] }).success).toBe(false);
    expect(JobRequest.safeParse({ ...request, photos: [] }).success).toBe(false);
  });

  it("takes only a JPEG data URL, never a link or another kind of file", () => {
    for (const bad of ["https://example.com/door.jpg", "data:image/png;base64,AAAA", "data:image/jpeg;base64,<script>"])
      expect(JobRequest.safeParse({ ...request, photos: [bad] }).success).toBe(false);
  });

  it("two full-size photos and the longest need still fit one sealed envelope", () => {
    const biggest = {
      ...request,
      need: "x".repeat(1000),
      details: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`detail_${"abcdefghijkl"[i]}`, "y".repeat(300)]),
      ),
      photos: Array.from({ length: MAX_PHOTOS }, () => photo(PHOTO_MAX_CHARS)),
    };
    const json = JSON.stringify(JobRequest.parse(biggest));
    // Sealing adds a nonce, a tag and the envelope's own fields, then base64 grows it by a third.
    const ENVELOPE_ROOM = 8 * 1024;
    expect(Math.ceil(((json.length + ENVELOPE_ROOM) * 4) / 3)).toBeLessThan(MAX_CIPHERTEXT_CHARS);
  });
});

describe("board", () => {
  const profile = { display_name: "Ravi", trades: ["electrician"], area, area_name: "Indiranagar", rate_paise: 50000 };
  it("accepts a worker card and defaults the optional fields", () => {
    expect(BoardProfile.parse(profile)).toMatchObject({ languages: [], about: "" });
  });
  it("refuses repeated trades", () => {
    expect(BoardProfile.safeParse({ ...profile, trades: ["maid", "maid"] }).success).toBe(false);
  });
  it("coerces a query string and applies defaults", () => {
    const q = BoardQuery.parse({ trade: "plumber", lat: "12.9", lon: "77.6" });
    expect(q).toMatchObject({ lat: 12.9, lon: 77.6, radius_km: 5, limit: 10 });
  });
  it("caps the radius", () => {
    expect(BoardQuery.safeParse({ trade: "plumber", lat: 1, lon: 1, radius_km: 500 }).success).toBe(false);
  });
});
