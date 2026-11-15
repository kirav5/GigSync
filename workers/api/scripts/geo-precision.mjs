// Scores the place search (ADR 0045) against Ola's own answer: for known Bengaluru places, how far the point our
// `/v1/geo/search` returns is from Ola's point for the same suggestion, and whether the area we name is the locality
// in Ola's own line. Run by hand against a local API with the key, never in CI (it spends the map quota):
//   node --env-file=.dev.vars scripts/geo-precision.mjs --api http://localhost:8814 [--near 12.97,77.59]
// OLA_MAPS_API_KEY and DEV_OTP come from the environment and are never printed. `--near` biases both lookups to a
// city's centre, as the phone does.
import { parseArgs } from "node:util";

const OLA_AUTOCOMPLETE = "https://api.olamaps.io/places/v1/autocomplete";
/** How far around `--near` the suggestions are biased, in metres: the same as the API's. */
const BIAS_RADIUS_M = 50_000;
const EARTH_RADIUS_M = 6_371_000;
/** A made-up number for the script's own sign-in on the local stack. */
const PHONE = "+919000000814";
const PLACES = [
  "LGCL Bamboo Forest Villas",
  "Jayanagar 4th Block",
  "Koramangala Forum Mall",
  "HSR Layout BDA Complex",
  "Indiranagar 100 Feet Road",
  "Whitefield ITPL",
  "Electronic City Infosys",
  "MG Road Metro",
  "Lalbagh West Gate",
  "Hebbal flyover",
  "Marathahalli bridge",
  "BTM Layout Udupi Garden",
  "Yelahanka New Town",
  "Banashankari temple",
  "Malleshwaram 18th Cross",
];

const { values } = parseArgs({ options: { api: { type: "string" }, near: { type: "string" } } });
const api = values.api ?? "http://localhost:8814";
const near = values.near?.split(",").map(Number);
const { OLA_MAPS_API_KEY: key, DEV_OTP: code } = process.env;
if (!key || !code) {
  console.error("Set OLA_MAPS_API_KEY and DEV_OTP (node --env-file=.dev.vars ...).");
  process.exit(1);
}

const rad = (d) => (d * Math.PI) / 180;
/** Metres between two points on the Earth's surface. */
function metres(a, b) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

async function signIn() {
  const device = { signing_key: "precision-script", encryption_key: "precision-script", protocol: 1 };
  const res = await fetch(`${api}/v1/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: PHONE, code, device }),
  });
  if (!res.ok) throw new Error(`sign-in answered ${res.status}`);
  return (await res.json()).token;
}

async function olaSuggestions(q) {
  const params = new URLSearchParams({ input: q, api_key: key });
  if (near) params.set("location", near.join(","));
  if (near) params.set("radius", String(BIAS_RADIUS_M));
  const res = await fetch(`${OLA_AUTOCOMPLETE}?${params}`);
  if (!res.ok) throw new Error(`Ola answered ${res.status}`);
  return (await res.json()).predictions ?? [];
}

async function ours(token, q) {
  const params = new URLSearchParams({ q });
  if (near) params.set("lat", String(near[0]));
  if (near) params.set("lon", String(near[1]));
  const res = await fetch(`${api}/v1/geo/search?${params}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`our search answered ${res.status}`);
  return (await res.json()).places;
}

const token = await signIn();
const rows = [];
for (const q of PLACES) {
  const [olas, found] = await Promise.all([olaSuggestions(q), ours(token, q.toLowerCase())]);
  // Our first place, and Ola's suggestion with the same line.
  const place = found[0];
  const ola = place && olas.find((s) => s.description.startsWith(place.label));
  if (!place || !ola) {
    rows.push({ q, metres: "-", area: place?.locality ?? "-", matches: "-", ola: ola?.description ?? "-" });
    continue;
  }
  const at = { lat: ola.geometry.location.lat, lon: ola.geometry.location.lng };
  const matches = ola.description.toLowerCase().includes(place.locality.toLowerCase());
  rows.push({ q, metres: Math.round(metres(at, place.point)), area: place.locality, matches, ola: ola.description });
}

console.log("| Place | Metres from Ola's point | Our area | In Ola's line |");
console.log("| --- | ---: | --- | --- |");
for (const r of rows)
  console.log(
    `| ${r.q} | ${r.metres} | ${r.area} | ${r.matches === true ? "yes" : r.matches === false ? "no" : "-"} |`,
  );
const scored = rows.filter((r) => typeof r.metres === "number");
const median = scored.map((r) => r.metres).sort((a, b) => a - b)[Math.floor(scored.length / 2)];
const matched = scored.filter((r) => r.matches).length;
console.log(
  `\n${scored.length}/${rows.length} scored; median ${median} m; max ${Math.max(...scored.map((r) => r.metres))} m; area in Ola's line ${matched}/${scored.length}`,
);
