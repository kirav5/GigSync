import { isLiveCity } from "@gigsync/core";
import type { ServedCities } from "@gigsync/protocol";
import { Hono } from "hono";
import { type AppEnv, Var } from "../context.js";
import { liveCities } from "../db/cities.js";
import { liveCitiesOf } from "../live-cities.js";

/** The cities and areas GigSync serves (ADR 0061), as `LIVE_CITIES` keeps them, for a phone to cache. */
export const cities = new Hono<AppEnv>();

cities.get("/", async (c) => {
  const live = liveCitiesOf(c.env);
  const served = (await liveCities(c.get(Var.db))).filter((city) => isLiveCity(live, city.key));
  return c.json({ cities: served, ...(live.anywhere ? { anywhere: true } : {}) } satisfies ServedCities);
});
