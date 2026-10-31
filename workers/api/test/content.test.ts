import { HttpMethod } from "@gigsync/core";
import { CityGuide } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

describe("city guides", () => {
  it("serves the Bengaluru guide, labelled as a draft, with sources and needs_checking", async () => {
    const p = await signIn("+919844400001");
    const res = await call(p, HttpMethod.get, "/content/bengaluru");
    expect(res.status).toBe(200);
    const guide = CityGuide.parse(await res.json());
    expect(guide.status).toBe("draft");
    expect(guide.label).toBe("Draft from public sources. Not yet checked by a union.");
    expect(guide.needs_checking.length).toBeGreaterThan(0);
    expect(guide.costs.find((c) => c.amount === "Rs 80")?.amount_paise).toBe(8000);
  });

  it("answers 404 for a city without a guide", async () => {
    const p = await signIn("+919844400002");
    expect((await call(p, HttpMethod.get, "/content/mumbai")).status).toBe(404);
    expect((await call(p, HttpMethod.get, "/content/..%2Fpackage")).status).toBe(404);
  });

  it("needs a session", async () => {
    expect((await call(undefined, HttpMethod.get, "/content/bengaluru")).status).toBe(401);
  });
});
