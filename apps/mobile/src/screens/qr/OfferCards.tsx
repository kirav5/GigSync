import type { GigDevice, MessageKey, ReceivedOffer } from "@gigsync/core";
import { useState } from "react";
import type { ChosenWorker } from "../../find/ask.js";
import { useI18n } from "../../i18n.js";
import { qrErrorKey } from "../../qr/problems.js";
import { useServedRecords } from "../../qr/useServedRecords.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { useBusy } from "../../ui/useBusy.js";
import { WorkerCard } from "./PersonCard.js";
import "./qr.css";
import { cardWork } from "../../ui/work.js";

interface Props {
  offers: readonly ReceivedOffer[];
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens a Find chat addressed to this worker. */
  onAsk: (worker: ChosenWorker) => void;
}

/**
 * Workers who scanned this household's QR and offered to work for it, with their card and the record the board
 * serves for them (capped by the server; the sealed card's own is never shown): Ask opens the usual request to
 * that worker alone, so the household is still the one who asks; Not now sends nothing. Nothing shows without offers.
 */
export function OfferCards({ offers, device, run, onAsk }: Props) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<MessageKey>();
  const served = useServedRecords(
    device,
    offers.map((o) => o.worker),
  );
  if (offers.length === 0) return null;

  const answer = (work: () => Promise<unknown>) =>
    guard(() => run(work)).catch((err: unknown) => setProblem(qrErrorKey(err)));
  const ask = (o: ReceivedOffer) =>
    answer(async () => {
      const asked = await device.offers.ask(o.channel);
      onAsk({ user: asked.worker, card: asked.card });
    });

  const title = t("qr.offers");
  return (
    // Under the Jobs tab's Needs you, before the jobs whose decisions wait: a heading one step below it.
    <section className="job-section" aria-label={title}>
      <h3 className="job-day">{title}</h3>
      <BusyGroup busy={busy}>
        {offers.map((o) => {
          const line = t("qr.offer_line", { name: o.card.display_name, trade: cardWork(t, o.card) });
          return (
            <article key={o.channel} className={C.cardWait} aria-label={line}>
              <strong>{line}</strong>
              <WorkerCard card={{ ...o.card, record: served.get(o.worker) }} />
              <div className={C.actions}>
                <button type={C.button} className={C.accent} onClick={() => void ask(o)}>
                  {t("qr.offer_ask")}
                </button>
                <button
                  type={C.button}
                  className={C.secondary}
                  onClick={() => void answer(() => device.offers.decline(o.channel))}
                >
                  {t("qr.offer_not_now")}
                </button>
              </div>
            </article>
          );
        })}
      </BusyGroup>
      {problem && (
        <p className={C.error} role="status">
          {t(problem)}
        </p>
      )}
    </section>
  );
}
