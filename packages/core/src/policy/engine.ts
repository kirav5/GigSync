import {
  type AccessRequest,
  type Decision,
  type Grant,
  MODE_ORDER,
  PRECISION_ORDER,
  type Precision,
} from "@collab/protocol";

/**
 * Deterministic: no model is involved. Given the owner's grants and one grounded request, says whether to answer,
 * how (auto / review / ask) and, for location, how precisely. When several grants apply, the most restrictive wins
 * on both axes. The Kotlin and Swift background responders implement the same rules; vectors/policy.json keeps
 * them honest.
 */
export function decide(grants: readonly Grant[], request: AccessRequest): Decision {
  const now = Date.parse(request.at);
  let sawExpired = false;
  let sawOutsideHours = false;
  const live: Grant[] = [];

  for (const g of grants) {
    if (g.grantee !== request.from || g.topic !== request.topic) continue;
    if (g.expires_at && Date.parse(g.expires_at) <= now) {
      sawExpired = true;
      continue;
    }
    if (g.hours && !(request.local_hour >= g.hours.start && request.local_hour < g.hours.end)) {
      sawOutsideHours = true;
      continue;
    }
    live.push(g);
  }

  if (live.length === 0) {
    if (sawOutsideHours) return { allow: false, reason: "outside_hours" };
    if (sawExpired) return { allow: false, reason: "expired" };
    return { allow: false, reason: "no_grant" };
  }

  // Most restrictive mode, then coarsest precision. The grant that set the winning precision is the one reported.
  let winner = live[0] as Grant;
  for (const g of live.slice(1)) {
    if (MODE_ORDER.indexOf(g.mode) > MODE_ORDER.indexOf(winner.mode)) winner = g;
  }
  const mode = winner.mode;

  if (request.topic !== "location") return { allow: true, mode, grant: winner.id };

  let precision: Precision = coarsest(live.map((g) => g.precision ?? "city"));
  let precisionGrant = live.find((g) => (g.precision ?? "city") === precision) ?? winner;
  if (request.precision && rank(request.precision) < rank(precision)) {
    precision = request.precision;
    precisionGrant = winner;
  }
  return { allow: true, mode, precision, grant: precisionGrant.id };
}

const rank = (p: Precision) => PRECISION_ORDER.indexOf(p);
const coarsest = (ps: Precision[]) => ps.reduce((a, b) => (rank(b) < rank(a) ? b : a));
