import type { GigDevice, MessageKey, ReceivedOffer } from "@gigsync/core";
import { useState } from "react";
import type { ChosenWorker } from "../../find/ask.js";
import { useI18n } from "../../i18n.js";
import { qrErrorKey } from "../../qr/problems.js";
import { C } from "../../ui/cls.js";
import { WorkerCard } from "./PersonCard.js";
import "./qr.css";

interface Props {
  offers: readonly ReceivedOffer[];
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens the usual ask with this worker chosen. */
  onAsk: (worker: ChosenWorker) => void;
}

/**
 * Workers who scanned this household's QR and offered to work for it, with their card: Ask opens the usual request to
 * that worker alone, so the household is still the one who asks; Not now sends nothing. Nothing shows without offers.
 */
export function OfferCards({ offers, device, run, onAsk }: Props) {
  const { t } = useI18n();
  const [problem, setProblem] = useState<MessageKey>();
  if (offers.length === 0) return null;

  const answer = (work: () => Promise<unknown>) => run(work).catch((err: unknown) => setProblem(qrErrorKey(err)));
  const ask = (o: ReceivedOffer) =>
    answer(async () => {
      const asked = await device.offers.ask(o.channel);
      onAsk({ user: asked.worker, card: asked.card });
    });

  const title = t("qr.offers");
  return (
    <section className="job-section" aria-label={title}>
      <h2>{title}</h2>
      {offers.map((o) => {
        const [trade] = o.card.trades;
        const line = t("qr.offer_line", { name: o.card.display_name, trade: trade ? t(`trade.${trade}`) : "" });
        return (
          <article key={o.channel} className={C.cardWait} aria-label={line}>
            <strong>{line}</strong>
            <WorkerCard card={o.card} />
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
      {problem && (
        <p className={C.error} role="status">
          {t(problem)}
        </p>
      )}
    </section>
  );
}
