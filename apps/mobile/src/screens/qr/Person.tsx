import type { GigDevice, MessageKey } from "@gigsync/core";
import { type QrCode, type QrPerson, QrRole } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { type Account, AccountRole } from "../../adapters/account.js";
import { publicCard } from "../../card/publish.js";
import type { ChosenWorker } from "../../find/ask.js";
import { useI18n } from "../../i18n.js";
import { qrErrorKey } from "../../qr/problems.js";
import { usePerson } from "../../qr/usePerson.js";
import { C } from "../../ui/cls.js";
import { Initial, WorkerCard } from "./PersonCard.js";

interface Props {
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  code: QrCode;
  /** Opens a Find chat addressed to this worker. */
  onAsk: (worker: ChosenWorker) => void;
}

/**
 * Whoever a scanned QR or an opened `?to=` link finds, after sign-in: a worker's card with "Ask {name} for work" for a
 * household, or a household's first name with "Offer to work for {name}" for a worker with a card on the board.
 */
export function Person({ account, device, run, code, onAsk }: Props) {
  const { t } = useI18n();
  const found = usePerson(account, code);
  if (!found) return <p className={C.muted}>{t("qr.finding")}</p>;
  if ("problem" in found)
    return (
      <p className={C.error} role="status">
        {t(found.problem)}
      </p>
    );
  const { person } = found;
  if (person.user === account.session.user) return <div className={C.empty}>{t("qr.yours")}</div>;
  if (person.role === QrRole.enum.worker) return <ScannedWorker account={account} person={person} onAsk={onAsk} />;
  return <ScannedHousehold account={account} device={device} run={run} code={code} person={person} />;
}

type WorkerPerson = Extract<QrPerson, { role: typeof QrRole.enum.worker }>;
type HouseholdPerson = Extract<QrPerson, { role: typeof QrRole.enum.household }>;

function ScannedWorker({ account, person, onAsk }: { account: Account; person: WorkerPerson; onAsk: Props["onAsk"] }) {
  const { t } = useI18n();
  const { card, user } = person;
  const household = account.role === AccountRole.consumer;
  return (
    <section className={C.card} aria-label={person.first_name}>
      {card ? <WorkerCard card={card} /> : <span>{t("qr.no_card", { name: person.first_name })}</span>}
      {household && card && (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={() => onAsk({ user, card })}>
            {t("qr.ask", { name: card.display_name })}
          </button>
        </div>
      )}
      {!household && <span className={C.faint}>{t("qr.worker_to_worker")}</span>}
    </section>
  );
}

function ScannedHousehold(props: Omit<Props, "onAsk"> & { person: HouseholdPerson }) {
  const { account, device, run, code, person } = props;
  const { t } = useI18n();
  const name = person.first_name;
  const card = publicCard(account);
  const [status, setStatus] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void device.offers.offeredToday(person.user).then((sent) => sent && setStatus("qr.offered"));
  }, [device, person.user]);

  const offer = async () => {
    if (!card) return;
    setBusy(true);
    try {
      await run(() => device.offers.offer(code, person.user, card));
      setStatus("qr.offered");
    } catch (err) {
      setStatus(qrErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const worker = account.role === AccountRole.worker;
  return (
    <section className={C.card} aria-label={name}>
      <div className={C.row}>
        <Initial name={name} />
        <div className="who">
          <strong>{name}</strong>
          <span className={C.muted}>{t("qr.household")}</span>
        </div>
      </div>
      {worker && card && status === undefined && (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} disabled={busy} aria-busy={busy} onClick={() => void offer()}>
            {t("qr.offer", { name })}
          </button>
        </div>
      )}
      {worker && !card && <span className={C.muted}>{t("qr.need_card", { name })}</span>}
      {!worker && <span className={C.faint}>{t("qr.household_to_household", { name })}</span>}
      <span className={C.muted} role="status" aria-live="polite">
        {status && t(status, { name })}
      </span>
    </section>
  );
}
