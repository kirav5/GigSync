import { createExecutionContext, env } from "cloudflare:test";
import { BEARER_PREFIX, Header } from "@gigsync/core";
import { GeoResult } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OLA_BASE, OlaPath, placeOf } from "../src/geo/ola.js";
import app from "../src/index.js";
import { type Person, signIn } from "./people.js";

/**
 * The routes are called in this isolate, not through SELF, so the stubbed `fetch` stands in for the provider.
 */
const get = (as: Person | undefined, path: string, bindings: Record<string, unknown> = {}): Promise<Response> =>
  Promise.resolve(
    app.fetch(
      new Request(`http://x/v1${path}`, {
        headers: as ? { [Header.authorization]: `${BEARER_PREFIX}${as.session.token}` } : {},
      }),
      { ...env, ...bindings },
      createExecutionContext(),
    ),
  );

/** ADR 0045: geocoding through our Worker, from a coarse point or typed words. */

const part = (long_name: string, ...types: string[]) => ({ long_name, types });
const result = (lat: number, lng: number, parts: ReturnType<typeof part>[]) => ({
  formatted_address: "12th Main, Banashankari 2nd Stage, Bengaluru, Karnataka 560070, India",
  address_components: parts,
  geometry: { location: { lat, lng } },
});
const BANASHANKARI = result(12.92531, 77.54672, [
  part("12th Main", "route"),
  part("Banashankari 2nd Stage", "sublocality_level_1", "sublocality"),
  part("Bengaluru", "locality"),
  part("560070", "postal_code"),
]);

const answered = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }));

afterEach(() => vi.restoreAllMocks());

describe("a geocoder's answer as places", () => {
  it("takes the most specific locality, the city, a six-digit PIN and the street, at a coarse point", () => {
    expect(placeOf(BANASHANKARI)).toEqual({
      label: BANASHANKARI.formatted_address,
      locality: "Banashankari 2nd Stage",
      city: "Bengaluru",
      pin: "560070",
      street: "12th Main",
      point: { lat: 12.93, lon: 77.55 },
    });
  });

  it("drops a PIN that is not one, and a result with no locality", () => {
    const odd = result(12.9, 77.5, [part("Bengaluru", "locality"), part("ABC", "postal_code")]);
    expect(placeOf(odd)?.pin).toBeUndefined();
    expect(placeOf(odd)?.locality).toBe("Bengaluru");
    expect(placeOf(result(12.9, 77.5, [part("Karnataka", "administrative_area_level_1")]))).toBeUndefined();
  });
});

describe("GET /v1/geo/reverse", () => {
  it("rounds the point before asking the provider, answers places, and serves the cell from cache after", async () => {
    const p = await signIn("+919877700001");
    const fetched = answered({ results: [BANASHANKARI] });
    const res = await get(p, "/geo/reverse?lat=12.925311&lon=77.546722");
    expect(res.status).toBe(200);
    const { places } = GeoResult.parse(await res.json());
    expect(places.map((x) => x.locality)).toEqual(["Banashankari 2nd Stage"]);
    const asked = new URL(String(fetched.mock.calls[0]?.[0]));
    expect(`${asked.origin}${asked.pathname}`).toBe(`${OLA_BASE}${OlaPath.reverse}`);
    expect(asked.searchParams.get("latlng")).toBe("12.93,77.55");
    expect(asked.searchParams.get("api_key")).toBe("test-only-ola-key");
    // The same cell again: from cache, the provider is not asked.
    const again = await get(p, "/geo/reverse?lat=12.93&lon=77.549");
    expect(GeoResult.parse(await again.json()).places).toEqual(places);
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it("answers 502 when the provider fails, and refuses bad points and no session", async () => {
    const p = await signIn("+919877700002");
    answered({ error: "quota" }, 429);
    expect((await get(p, "/geo/reverse?lat=13.11&lon=77.11")).status).toBe(502);
    expect((await get(p, "/geo/reverse?lat=200&lon=77")).status).toBe(400);
    expect((await get(p, "/geo/reverse?lat=13")).status).toBe(400);
    expect((await get(undefined, "/geo/reverse?lat=13.2&lon=77.2")).status).toBe(401);
  });
});

describe("without the provider's key", () => {
  it("answers 503, so the app offers typing the address instead", async () => {
    const p = await signIn("+919877700005");
    const fetched = answered({ results: [BANASHANKARI] });
    const res = await get(p, "/geo/reverse?lat=12.5&lon=77.5", { OLA_MAPS_API_KEY: undefined });
    expect(res.status).toBe(503);
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe("GET /v1/geo/search", () => {
  it("asks for the typed words and answers at most five places, one per line", async () => {
    const p = await signIn("+919877700003");
    const fetched = answered({ geocodingResults: Array.from({ length: 7 }, () => BANASHANKARI) });
    const res = await get(p, `/geo/search?q=${encodeURIComponent("Banashankari  2nd")}`);
    const { places } = GeoResult.parse(await res.json());
    expect(places).toHaveLength(1);
    expect(new URL(String(fetched.mock.calls[0]?.[0])).searchParams.get("address")).toBe("banashankari 2nd");
  });

  it("refuses words too short or too long", async () => {
    const p = await signIn("+919877700004");
    expect((await get(p, "/geo/search?q=ab")).status).toBe(400);
    expect((await get(p, `/geo/search?q=${"x".repeat(81)}`)).status).toBe(400);
  });
});
