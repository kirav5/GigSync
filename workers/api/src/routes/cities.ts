import type { ServedCities } from "@gigsync/protocol";
import { Hono } from "hono";
import { type AppEnv, Var } from "../context.js";
import { liveCities } from "../db/cities.js";

/** The cities and areas GigSync serves (ADR 0061), for a phone to cache. */
export const cities = new Hono<AppEnv>();

cities.get("/", async (c) => c.json({ cities: await liveCities(c.get(Var.db)) } satisfies ServedCities));
