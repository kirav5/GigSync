import { type Spread, spread, table } from "../lib/stats.js";
import type { StepResult } from "./step.js";
import type { DbSample, Machine } from "./watch.js";

/** Calls made after the step's end belong to cleanup (cards down, sign-out), not to the load. */
const CLEANUP_ROUTES = new Set(["DELETE /v1/board/profile", "POST /v1/me/signout"]);
const MS_PER_S = 1000;
const SERVER_ERROR = 500;

export interface RouteSummary extends Spread {
  route: string;
  errors: number;
  perS: number;
}

export interface AppStepSummary {
  users: number;
  seconds: number;
  requests: number;
  perS: number;
  errorShare: number;
  signInFailures: number;
  households: number;
  signed: number;
  toSign: Spread;
  routes: RouteSummary[];
  machine: Machine;
  db?: { max: number; peakTotal: number; peakActive: number; xacts: number; xactsPerRequest: number };
}

const xactsOf = (samples: readonly DbSample[]) =>
  samples.length < 2 ? 0 : (samples.at(-1)?.xacts ?? 0) - (samples[0]?.xacts ?? 0);

/** A call failed when it never got an answer or the server failed; 4xx answers are the app's own (429 counts). */
const failed = (status: number) => status === 0 || status >= SERVER_ERROR || status === 429;

export function summarise(
  users: number,
  seconds: number,
  r: StepResult,
  machine: Machine,
  db?: { max: number; samples: DbSample[] },
): AppStepSummary {
  const hits = r.hits.filter((h) => !CLEANUP_ROUTES.has(h.route));
  const routes = [...new Set(hits.map((h) => h.route))].sort().map((route) => {
    const own = hits.filter((h) => h.route === route);
    return {
      route,
      ...spread(own.filter((h) => !failed(h.status)).map((h) => h.ms)),
      errors: own.filter((h) => failed(h.status)).length,
      perS: Number((own.length / seconds).toFixed(2)),
    };
  });
  const households = r.journeys.filter((j) => j.role === "household");
  const signedMs = households.flatMap((j) => (j.signedMs === undefined ? [] : [j.signedMs]));
  return {
    users,
    seconds,
    requests: hits.length,
    perS: Number((hits.length / seconds).toFixed(1)),
    errorShare: hits.length ? hits.filter((h) => failed(h.status)).length / hits.length : 0,
    signInFailures: r.signInFailures,
    households: households.length,
    signed: signedMs.length,
    toSign: spread(signedMs.map((ms) => ms / MS_PER_S)),
    routes,
    machine,
    ...(db
      ? {
          db: {
            max: db.max,
            peakTotal: Math.max(0, ...db.samples.map((s) => s.total)),
            peakActive: Math.max(0, ...db.samples.map((s) => s.active)),
            // Pilot traffic on the same database is in this count too; it is small beside a step's.
            xacts: xactsOf(db.samples),
            xactsPerRequest: Number((xactsOf(db.samples) / Math.max(1, r.hits.length)).toFixed(2)),
          },
        }
      : {}),
  };
}

export function printStep(s: AppStepSummary): void {
  const head = [
    `${s.users} users, ${s.seconds}s: ${s.requests} requests (${s.perS}/s), ${(100 * s.errorShare).toFixed(1)}% failed`,
    `sign-in failures ${s.signInFailures}; households signed ${s.signed}/${s.households}, seconds to sign p50 ${s.toSign.p50 ?? "-"} p90 ${s.toSign.p90 ?? "-"}`,
    `generator: loop p99 ${s.machine.loopP99Ms} ms, CPU ${s.machine.cpuPercent}% of a core`,
    ...(s.db
      ? [
          `db: peak ${s.db.peakTotal} connections (${s.db.peakActive} active) of ${s.db.max}; ${s.db.xacts} transactions, ${s.db.xactsPerRequest} per request`,
        ]
      : []),
  ];
  console.log(`\n${head.join("\n")}`);
  console.log(
    table(s.routes as unknown as Record<string, unknown>[], [
      "route",
      "n",
      "perS",
      "errors",
      "p50",
      "p90",
      "p99",
      "max",
    ]),
  );
}
