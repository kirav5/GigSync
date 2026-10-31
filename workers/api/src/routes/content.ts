import { City, CityGuide } from "@gigsync/protocol";
import { Hono } from "hono";
import bengaluru from "../../content/bengaluru.json";
import { ApiError, type AppEnv } from "../context.js";

/** Path parameter naming the city a guide is for. */
const CITY_PARAM = "city";

/** The guide files bundled with the Worker, one per city that has one. */
const FILES: Record<City, unknown> = { [City.enum.bengaluru]: bengaluru };
/** Each guide is checked against the schema once per isolate, so a bad file fails loudly instead of reaching phones. */
const parsed = new Map<City, CityGuide>();

function guide(city: City): CityGuide {
  const cached = parsed.get(city);
  if (cached) return cached;
  const fresh = CityGuide.parse(FILES[city]);
  parsed.set(city, fresh);
  return fresh;
}

/** City guides for the landing journey, behind the session middleware. Read-only, the same for everyone. */
export const content = new Hono<AppEnv>();

content.get(`/:${CITY_PARAM}`, (c) => {
  const city = City.safeParse(c.req.param(CITY_PARAM));
  if (!city.success) return c.json({ error: ApiError.notFound }, 404);
  return c.json(guide(city.data));
});
