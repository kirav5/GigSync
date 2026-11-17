import { createExecutionContext, env } from "cloudflare:test";
import { BEARER_PREFIX, Header } from "@gigsync/core";
import { GeoResult } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BIAS_RADIUS_M, OLA_BASE, OlaPath, placeOf } from "../src/geo/ola.js";
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
  it("asks autocomplete for the typed words, and each suggestion's area from its point, one place per line", async () => {
    const p = await signIn("+919877700003");
    const line = (n: number) => `${n}th Cross, Banashankari 2nd Stage, Bengaluru, Karnataka, 560070, India`;
    // Seven suggestions: at most five are looked up, and each keeps its own line as the label.
    const predictions = Array.from({ length: 7 }, (_, n) => ({
      description: line(n),
      geometry: { location: { lat: 12.92531, lng: 77.54672 } },
    }));
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        Response.json(
          new URL(String(url)).pathname.endsWith(OlaPath.autocomplete) ? { predictions } : { results: [BANASHANKARI] },
        ),
      );
    const res = await get(p, `/geo/search?q=${encodeURIComponent("Banashankari  2nd")}`);
    const { places } = GeoResult.parse(await res.json());
    expect(places.map((place) => place.label)).toEqual([0, 1, 2, 3, 4].map(line));
    // The place's own point, not its coarse cell: a building lands on its door.
    expect(places[0]).toMatchObject({
      locality: "Banashankari 2nd Stage",
      pin: "560070",
      point: { lat: 12.92531, lon: 77.54672 },
    });
    const asked = new URL(String(fetched.mock.calls[0]?.[0]));
    expect(asked.pathname.endsWith(OlaPath.autocomplete)).toBe(true);
    expect(asked.searchParams.get("input")).toBe("banashankari 2nd");
    expect(asked.searchParams.has("location")).toBe(false);
    // Autocomplete once, then the five places shown named, each from its own point (the other two never).
    expect(fetched).toHaveBeenCalledTimes(6);
  });

  it("names a found place from its own point, never its cell, and favours the city it was asked near", async () => {
    const p = await signIn("+919877700006");
    // LGCL Bamboo Forest Villas: its own point is in Choodasandra; its 2-decimal cell is in Parappana Agrahara.
    const villas = "LGCL Bamboo Forest Villas, Rayasandra Main Rd, Choodasandra, Bengaluru, Karnataka, 560100, India";
    const choodasandra = result(12.8773, 77.6745, [part("Choodasandra", "sublocality"), part("Bengaluru", "locality")]);
    const cell = result(12.88, 77.67, [part("Parappana Agrahara", "sublocality"), part("Bengaluru", "locality")]);
    const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const asked = new URL(String(url));
      if (asked.pathname.endsWith(OlaPath.autocomplete))
        return Response.json({
          predictions: [{ description: villas, geometry: { location: { lat: 12.8773, lng: 77.6745 } } }],
        });
      return Response.json({ results: [asked.searchParams.get("latlng") === "12.8773,77.6745" ? choodasandra : cell] });
    });
    const res = await get(p, "/geo/search?q=lgcl%20bamboo&lat=12.9716&lon=77.5946");
    const { places } = GeoResult.parse(await res.json());
    expect(places).toEqual([
      { label: villas, locality: "Choodasandra", city: "Bengaluru", point: { lat: 12.8773, lon: 77.6745 } },
    ]);
    const autocomplete = new URL(String(fetched.mock.calls[0]?.[0]));
    // The centre goes to the provider on the coarse grid only.
    expect(autocomplete.searchParams.get("location")).toBe("12.97,77.59");
    expect(autocomplete.searchParams.get("radius")).toBe(String(BIAS_RADIUS_M));
    // Another city's centre is another search, not the cached one.
    await get(p, "/geo/search?q=lgcl%20bamboo&lat=18.52&lon=73.86");
    const second = fetched.mock.calls
      .map(([u]) => new URL(String(u)))
      .filter((u) => u.pathname.endsWith(OlaPath.autocomplete));
    expect(second.map((u) => u.searchParams.get("location"))).toEqual(["12.97,77.59", "18.52,73.86"]);
  });

  it("takes the area its own line names before the city when the point's parts disagree with it", async () => {
    const p = await signIn("+919877700008");
    const line = "Hebbal FlyOver, Bayanna Layout, Hebbal, Bengaluru, Karnataka, 560024, India";
    const terms = line.split(", ").map((value) => ({ value }));
    const parts = [part("Sanjay Nagar", "sublocality"), part("Bengaluru", "locality"), part("560024", "postal_code")];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      Response.json(
        new URL(String(url)).pathname.endsWith(OlaPath.autocomplete)
          ? { predictions: [{ description: line, terms, geometry: { location: { lat: 13.0405, lng: 77.5897 } } }] }
          : { results: [result(13.0405, 77.5897, parts)] },
      ),
    );
    const { places } = GeoResult.parse(await (await get(p, "/geo/search?q=hebbal%20flyover")).json());
    expect(places[0]).toMatchObject({ locality: "Hebbal", city: "Bengaluru", pin: "560024" });
  });

  it("keeps the owner's own point coarse when naming it", async () => {
    const p = await signIn("+919877700007");
    const fetched = answered({ results: [result(12.8773, 77.6745, [part("Choodasandra", "sublocality")])] });
    const { places } = GeoResult.parse(await (await get(p, "/geo/reverse?lat=12.877312&lon=77.674533")).json());
    expect(new URL(String(fetched.mock.calls[0]?.[0])).searchParams.get("latlng")).toBe("12.88,77.67");
    expect(places[0]?.point).toEqual({ lat: 12.88, lon: 77.67 });
  });

  it("refuses words too short or too long", async () => {
    const p = await signIn("+919877700004");
    expect((await get(p, "/geo/search?q=ab")).status).toBe(400);
    expect((await get(p, `/geo/search?q=${"x".repeat(81)}`)).status).toBe(400);
  });
});
