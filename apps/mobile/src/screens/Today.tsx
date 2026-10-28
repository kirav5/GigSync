import type { MessageKey } from "@gigsync/core";
import { rupees, summarize } from "@gigsync/core";
import type { Engagement } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { JobStep, jobStep } from "../payments/store.js";
import { type GigData, Screen } from "../state.js";
import { C } from "../ui/cls.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { JobCard } from "./JobCard.js";

const TILES: readonly { screen: Screen; icon: IconName; text: MessageKey }[] = [
  { screen: Screen.jobs, icon: "plus", text: "today.tile_jobs" },
  { screen: Screen.pay, icon: "qr", text: "today.tile_pay" },
  { screen: Screen.record, icon: "book", text: "today.tile_record" },
  { screen: Screen.agent, icon: "chat", text: "today.tile_agent" },
];

interface Props {
  data: GigData;
  go: (s: Screen) => void;
  pay: (job: Engagement) => void;
}

/** The start screen: what the worker has earned, what is still owed, and where to go next. */
export function Today({ data, go, pay }: Props) {
  const { t } = useI18n();
  const sum = summarize(data.payments);
  const open = data.jobs.filter((j) => jobStep(j, data.payments) !== JobStep.paid);
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.today")}</span>
        <h1 className={C.headline}>
          {t("today.headline")} <span className={C.soft}>{t("today.soft")}</span>
        </h1>
      </div>

      {data.ready && !data.payee && (
        <div className={C.cardWait}>
          <strong>{t("today.add_upi_title")}</strong>
          <span className={C.muted}>{t("today.add_upi_about")}</span>
          <div>
            <button type={C.button} className={C.accent} onClick={() => go(Screen.settings)}>
              {t("today.add_upi")}
            </button>
          </div>
        </div>
      )}

      <div className="stats">
        <div>
          <span className={C.label}>{t("stat.received")}</span>
          <b className={C.money}>₹{rupees(sum.confirmed)}</b>
        </div>
        <div>
          <span className={C.label}>{t("stat.waiting")}</span>
          <b className={C.money}>₹{rupees(sum.outstanding)}</b>
        </div>
        <div>
          <span className={C.label}>{t("stat.open")}</span>
          <b>{open.length}</b>
        </div>
      </div>

      <div className="grid-tiles">
        {TILES.map((tile) => (
          <button key={tile.text} type={C.button} className="tile" onClick={() => go(tile.screen)}>
            <Icon name={tile.icon} />
            <p>{t(tile.text)}</p>
            <span className="arrow">→</span>
          </button>
        ))}
      </div>

      {open.length > 0 && (
        <section className={C.stack}>
          <span className={C.label}>{t("stat.open")}</span>
          {open.slice(0, 3).map((j) => (
            <JobCard key={j.id} job={j} payments={data.payments} onPay={pay} />
          ))}
        </section>
      )}
    </>
  );
}
