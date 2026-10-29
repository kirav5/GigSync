import type { Colleague, GigDevice, JobRecord, MessageKey } from "@gigsync/core";
import { useState } from "react";
import { ReferralAnswer } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { declinedByMe } from "../jobGroups.js";
import { linkedOnly, useColleagues } from "./context.js";
import { colleagueProblem } from "./problems.js";

interface Props {
  job: JobRecord;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/** Colleagues whose card lists the job's trade first, then the rest, each list in the order they were linked. */
function forTrade(colleagues: readonly Colleague[], job: JobRecord): Colleague[] {
  const does = (c: Colleague) => c.card.trades.includes(job.request.trade);
  return [...colleagues.filter(does), ...colleagues.filter((c) => !does(c))];
}

/**
 * The worker turned a request down: they may suggest a linked colleague to the household instead. The household's
 * phone must understand suggestions, which is checked before the picker opens; afterwards the card says who it was.
 */
export function SuggestColleague({ job, device, run }: Props) {
  const { t } = useI18n();
  const { colleagues, answers, answer } = useColleagues();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();
  const id = job.engagement.id;
  const linked = linkedOnly(colleagues);

  if (job.referred) {
    const name = colleagues.find((c) => c.user === job.referred)?.card.name;
    return name ? <p className={C.muted}>{t("refer.sent", { name })}</p> : null;
  }
  if (!declinedByMe(job) || linked.length === 0 || answers.has(id)) return null;

  async function open() {
    setBusy(true);
    setProblem(undefined);
    try {
      if (await device.colleagues.canReach(job.engagement.counterpart)) setPicking(true);
      else setProblem("refer.too_old");
    } catch (err) {
      setProblem(colleagueProblem("checking the household's phone failed", err));
    } finally {
      setBusy(false);
    }
  }

  async function send(colleague: Colleague) {
    setBusy(true);
    setProblem(undefined);
    try {
      await run(() => device.colleagues.suggest(id, colleague.user));
      setPicking(false);
    } catch (err) {
      setProblem(colleagueProblem("suggesting a colleague failed", err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className={C.stack} aria-label={t("refer.suggest")}>
      {picking ? (
        <>
          <span className={C.label}>{t("refer.pick")}</span>
          {forTrade(linked, job).map((c) => (
            <div key={c.user} className={C.row}>
              <div className="who">
                <strong>{c.card.name}</strong>
                <span className={C.muted}>{c.card.trades.map((tr) => t(`trade.${tr}`)).join(", ")}</span>
              </div>
              <button type={C.button} className={`${C.accent} end`} disabled={busy} onClick={() => void send(c)}>
                {t("refer.send", { name: c.card.name })}
              </button>
            </div>
          ))}
          <div className={C.actions}>
            <button type={C.button} className={C.secondary} onClick={() => setPicking(false)}>
              {t("colleague.cancel")}
            </button>
          </div>
        </>
      ) : (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} disabled={busy} onClick={() => void open()}>
            {t("refer.suggest")}
          </button>
          <button type={C.button} className={C.secondary} onClick={() => void answer(id, ReferralAnswer.no)}>
            {t("refer.no")}
          </button>
        </div>
      )}
      {problem && (
        <p className={C.error} role="status">
          {t(problem)}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The household's side: the worker can't take the job and suggests a colleague. Asking sends the same need to them as
 * a fresh request; No thanks puts the suggestion away. `them` is the worker's name as the card shows it.
 */
export function ReferralOffer({ job, device, run, them }: Props & { them: string }) {
  const { t } = useI18n();
  const { answers, answer, remember } = useColleagues();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();
  const referral = job.referral;
  if (!referral) return null;
  const id = job.engagement.id;
  const name = referral.card.name;
  const said = answers.get(id);
  if (said === ReferralAnswer.asked) return <p className={C.muted}>{t("refer.asked", { name })}</p>;
  if (said === ReferralAnswer.no) return null;
  // The job's own trade when the colleague's card lists it, as it should; else what their card says first.
  const trade = referral.card.trades.find((tr) => tr === job.request.trade) ?? referral.card.trades[0];
  const got = t("refer.got", { worker: them, name, trade: trade ? t(`trade.${trade}`) : "" });

  async function ask() {
    if (!referral) return;
    setBusy(true);
    setProblem(undefined);
    try {
      await remember(referral.colleague, name);
      await run(() => device.colleagues.askReferred(id));
      await answer(id, ReferralAnswer.asked);
    } catch (err) {
      setProblem(colleagueProblem("asking the suggested colleague failed", err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className={C.stack} aria-label={got}>
      <span>{got}</span>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} disabled={busy} onClick={() => void ask()}>
          {t("refer.ask", { name })}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => void answer(id, ReferralAnswer.no)}>
          {t("refer.no")}
        </button>
      </div>
      {problem && (
        <p className={C.error} role="status">
          {t(problem)}
        </p>
      )}
    </fieldset>
  );
}
