import { createExecutionContext, env } from "cloudflare:test";
import { BEARER_PREFIX, Header } from "@gigsync/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { OLA_ORIGIN, rewritten, STYLE_PATH } from "../src/routes/map.js";
import { type Person, signIn } from "./people.js";

/** ADR 0050 §7: Ola's map through our Worker, with the key added here and every link pointed back at us. */

const KEY = "test-key";
const get = (as: Person | undefined, path: string, key: string | undefined = KEY): Promise<Response> =>
  Promise.resolve(
    app.fetch(
      new Request(`http://x/v1/geo/map/${path}`, {
        headers: as ? { [Header.authorization]: `${BEARER_PREFIX}${as.session.token}` } : {},
      }),
      { ...env, OLA_MAPS_API_KEY: key },
      createExecutionContext(),
    ),
  );

const STYLE = {
  version: 8,
  sources: { ola: { type: "vector", url: `${OLA_ORIGIN}/tiles/vector/v1/data/planet.json?api_key=${KEY}` } },
  sprite: `${OLA_ORIGIN}/tiles/vector/v1/styles/default-light-standard/sprite`,
  glyphs: `${OLA_ORIGIN}/tiles/vector/v1/fonts/{fontstack}/{range}.pbf?api_key=${KEY}&v=2`,
};

afterEach(() => vi.restoreAllMocks());

describe("the map through GigSync", () => {
  it("serves Ola's style with every link pointed at this route and no key in it", async () => {
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(STYLE));
    const res = await get(await signIn("+919844400001"), "style.json");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(OLA_ORIGIN);
    expect(text).not.toContain(KEY);
    expect(JSON.parse(text).glyphs).toBe("http://x/v1/geo/map/tiles/vector/v1/fonts/{fontstack}/{range}.pbf?v=2");
    const asked = String(fetched.mock.calls[0]?.[0]);
    expect(asked).toBe(`${OLA_ORIGIN}/${STYLE_PATH}?api_key=${KEY}`);
  });

  it("passes a tile's bytes through, with the key added upstream", async () => {
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/x-protobuf" } }),
      );
    const res = await get(await signIn("+919844400002"), "tiles/vector/v1/data/planet/14/11720/7630.pbf");
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(String(fetched.mock.calls[0]?.[0])).toContain(`api_key=${KEY}`);
  });

  it("refuses paths outside Ola's map, without a key, and without a session", async () => {
    const me = await signIn("+919844400003");
    expect((await get(me, "places/v1/autocomplete?input=x")).status).toBe(404);
    expect((await get(me, "tiles/../places/v1/x")).status).toBe(404);
    expect((await get(me, "style.json", "")).status).toBe(503);
    expect((await get(undefined, "style.json")).status).toBe(401);
  });

  it("rewrites links and drops the key wherever it sits in a query", () => {
    const base = "https://api.gigsync.network/v1/geo/map/";
    expect(rewritten(`"${OLA_ORIGIN}/tiles/a.json?api_key=k"`, base)).toBe(`"${base}tiles/a.json"`);
    expect(rewritten(`"${OLA_ORIGIN}/tiles/a?x=1&api_key=k&y=2"`, base)).toBe(`"${base}tiles/a?x=1&y=2"`);
  });
});
