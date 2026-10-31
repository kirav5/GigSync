import { log, TaskKind } from "@gigsync/core";
import { EngagementStatus, type Place, type Trade } from "@gigsync/protocol";
import { type Person, worker } from "../test/world.js";

/**
 * Lists a few workers around Bengaluru on the local board and keeps their agents running, so one person can try the
 * consumer side in the app without a second phone. Each demo worker signs the deal its agent reaches, does the job,
 * asks for payment and confirms it. Ctrl+C (or SIGTERM) takes them off the board.
 *
 *   pnpm dev:workers   # the API on :8787
 *   pnpm demo:workers
 */

/** The app's pilot areas (apps/mobile/src/ui/places.ts), by centre. */
const AREA = {
  indiranagar: { name: "Indiranagar", lat: 12.9719, lon: 77.6412 },
  koramangala: { name: "Koramangala", lat: 12.9352, lon: 77.6245 },
  hsr: { name: "HSR Layout", lat: 12.9116, lon: 77.6474 },
  whitefield: { name: "Whitefield", lat: 12.9698, lon: 77.75 },
} as const satisfies Record<string, Place & { name: string }>;

const RUPEE = 100;
const DEMO: readonly { name: string; trades: Trade[]; where: Place & { name: string }; rate: number; min: number }[] = [
  { name: "Ramesh", trades: ["electrician"], where: AREA.indiranagar, rate: 700, min: 550 },
  { name: "Suresh", trades: ["electrician", "ac_technician"], where: AREA.koramangala, rate: 650, min: 500 },
  { name: "Mohan", trades: ["plumber"], where: AREA.indiranagar, rate: 600, min: 450 },
  { name: "Lakshmi", trades: ["maid"], where: AREA.indiranagar, rate: 400, min: 350 },
  { name: "Kavya", trades: ["maid", "cook"], where: AREA.hsr, rate: 450, min: 380 },
  { name: "Imran", trades: ["ac_technician"], where: AREA.whitefield, rate: 900, min: 700 },
];
/** Wide enough that every pilot area reaches every demo worker. */
const SERVICE_RADIUS_KM = 25;
/** As often as the app checks its mailbox while open (apps/mobile/src/useGig.ts). */
const SYNC_MS = 2000;

const S = EngagementStatus.enum;

/** What a worker does by hand in the app, done for them: on the way, done, ask for payment, confirm it arrived. */
async function work(p: Person): Promise<void> {
  await p.device.sync();
  const payments = await p.device.payments.all();
  for (const job of await p.device.jobs()) {
    const id = job.engagement.id;
    if (job.engagement.status !== S.agreed || payments.some((x) => x.engagement === id)) continue;
    await p.device.update(id, "On my way");
    await p.device.deliver(id, "Work done");
    await p.device.requestPayment(id, job.request.need.slice(0, 40));
    log.info("demo worker asked for payment", { worker: p.name });
  }
  for (const task of await p.device.tasks()) {
    if (task.kind !== TaskKind.confirmPayment) continue;
    await p.device.confirmPayment((task.detail as { id: string }).id);
    log.info("demo worker confirmed payment", { worker: p.name });
  }
}

const listed = await Promise.all(
  DEMO.map((d) =>
    worker(
      d.name,
      d.trades,
      { lat: d.where.lat, lon: d.where.lon },
      { rate: d.rate * RUPEE, min: d.min * RUPEE },
      {
        autoConfirm: true,
        radiusKm: SERVICE_RADIUS_KM,
        areaName: d.where.name,
      },
    ),
  ),
);
log.info("demo workers listed", { workers: listed.map((p) => p.name).join(", ") });

let stopping = false;
// Ctrl+C, or a terminal or tool stopping the process: either way, take the demo cards off the board first.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

while (!stopping) {
  await Promise.all(
    listed.map((p) =>
      work(p).catch((err) => log.warn("demo worker sync failed", { worker: p.name, error: String(err) })),
    ),
  );
  await new Promise((r) => setTimeout(r, SYNC_MS));
}
await Promise.all(listed.map((p) => p.api.removeProfile()));
log.info("demo workers removed from the board");
