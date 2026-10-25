import { rupees, summarize } from "@gigsync/core";
import type { Engagement } from "@gigsync/protocol";
import { JobStep, jobStep } from "../payments/store.js";
import { type GigData, Screen } from "../state.js";
import { C } from "../ui/cls.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { JobCard } from "./JobCard.js";

const TILES: readonly { screen: Screen; icon: IconName; text: string }[] = [
  { screen: Screen.jobs, icon: "plus", text: "Record a job you agreed" },
  { screen: Screen.pay, icon: "qr", text: "Show your UPI QR and get paid" },
  { screen: Screen.record, icon: "book", text: "See every job and payment" },
  { screen: Screen.agent, icon: "chat", text: "Ask your agent or note something" },
];

interface Props {
  data: GigData;
  go: (s: Screen) => void;
  pay: (job: Engagement) => void;
}

/** The start screen: what the worker has earned, what is still owed, and where to go next. */
export function Today({ data, go, pay }: Props) {
  const sum = summarize(data.payments);
  const open = data.jobs.filter((j) => jobStep(j, data.payments) !== JobStep.paid);
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>Today</span>
        <h1 className={C.headline}>
          On your side, <span className={C.soft}>every working day.</span>
        </h1>
      </div>

      {data.ready && !data.payee && (
        <div className={C.cardWait}>
          <strong>Add your UPI ID to get paid</strong>
          <span className={C.muted}>
            Customers pay you directly. It stays on this phone; GigSync never touches the money.
          </span>
          <div>
            <button type={C.button} className={C.accent} onClick={() => go(Screen.settings)}>
              Add UPI ID
            </button>
          </div>
        </div>
      )}

      <div className="stats">
        <div>
          <span className={C.label}>Received</span>
          <b className={C.money}>₹{rupees(sum.confirmed)}</b>
        </div>
        <div>
          <span className={C.label}>Waiting</span>
          <b className={C.money}>₹{rupees(sum.outstanding)}</b>
        </div>
        <div>
          <span className={C.label}>Open jobs</span>
          <b>{open.length}</b>
        </div>
      </div>

      <div className="grid-tiles">
        {TILES.map((t) => (
          <button key={t.text} type={C.button} className="tile" onClick={() => go(t.screen)}>
            <Icon name={t.icon} />
            <p>{t.text}</p>
            <span className="arrow">→</span>
          </button>
        ))}
      </div>

      {open.length > 0 && (
        <section className={C.stack}>
          <span className={C.label}>Open jobs</span>
          {open.slice(0, 3).map((j) => (
            <JobCard key={j.id} job={j} payments={data.payments} onPay={pay} />
          ))}
        </section>
      )}
    </>
  );
}
