import { agreeToRecords, deleteMyRecords, log, type MessageKey, type Ports, recordsAgreed } from "@gigsync/core";
import { useEffect, useState } from "react";
import { type Account, AccountRole } from "../../adapters/account.js";
import { recordsClient } from "../../adapters/records.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { NoticeWords } from "../record/Notice.js";

/** What the section shows below its line: nothing more, the notice to agree to, or the delete confirmation. */
const Open = { none: "none", notice: "notice", confirm: "confirm" } as const;
type Open = (typeof Open)[keyof typeof Open];

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Privacy's "My records with GigSync" (ADR 0038 §5): whether GigSync keeps this owner's job records, the notice to
 * agree to when it does not, and "Delete my records from GigSync" with a confirmation saying what goes.
 */
export function RecordsPrivacy({ ports, account }: { ports: Ports; account: Account }) {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState<boolean>();
  const [open, setOpen] = useState<Open>(Open.none);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ key: MessageKey; error: boolean }>();

  useEffect(() => {
    recordsAgreed(ports.storage)
      .then(setAgreed)
      .catch((err: unknown) => log.warn("reading the records answer failed", failure(err)));
  }, [ports]);

  async function act(work: () => Promise<unknown>, done: MessageKey, failed: MessageKey, now: boolean) {
    setBusy(true);
    try {
      await work();
      setAgreed(now);
      setOpen(Open.none);
      setSaid({ key: done, error: false });
    } catch (err) {
      log.warn("records change failed", failure(err));
      setSaid({ key: failed, error: true });
    } finally {
      setBusy(false);
    }
  }

  const api = () => recordsClient(account.session);
  const agree = () =>
    act(() => agreeToRecords(api(), ports.storage), "records.privacy_kept", "records.agree_failed", true);
  const remove = () =>
    act(() => deleteMyRecords(api(), ports.storage), "records.deleted", "records.delete_failed", false);
  const close = () => setOpen(Open.none);
  const isWorker = account.role === AccountRole.worker;
  const title = t("records.privacy_title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      {agreed !== undefined && (
        <span className={C.muted}>{t(agreed ? "records.privacy_kept" : "records.privacy_off")}</span>
      )}
      {open === Open.notice && (
        <div className={C.stack}>
          <NoticeWords />
          <Decide yes={t("records.agree")} no={t("records.not_now")} busy={busy} onYes={agree} onNo={close} />
        </div>
      )}
      {open === Open.confirm && (
        <div className={C.cardWait} role="dialog" aria-label={t("records.delete")}>
          <p>{t(isWorker ? "records.delete_confirm_worker" : "records.delete_confirm_household")}</p>
          <Decide
            yes={t("records.delete_yes")}
            no={t("records.delete_cancel")}
            danger
            busy={busy}
            onYes={remove}
            onNo={close}
          />
        </div>
      )}
      {open === Open.none && (
        <div className={C.actions}>
          {agreed === false && (
            <button type={C.button} className={C.secondary} onClick={() => setOpen(Open.notice)}>
              {t("records.privacy_agree")}
            </button>
          )}
          <button type={C.button} className={C.quiet} onClick={() => setOpen(Open.confirm)}>
            {t("records.delete")}
          </button>
        </div>
      )}
      {said && (
        <p className={said.error ? C.dockError : C.faint} role="status" aria-live="polite">
          {t(said.key)}
        </p>
      )}
    </section>
  );
}

interface DecideProps {
  yes: string;
  no: string;
  /** The yes button deletes something: drawn as a danger button. */
  danger?: boolean;
  busy: boolean;
  onYes: () => Promise<void>;
  onNo: () => void;
}

/** A yes and a no, side by side; yes waits while the last one is on its way. */
function Decide({ yes, no, danger = false, busy, onYes, onNo }: DecideProps) {
  return (
    <div className={C.actions}>
      <button type={C.button} className={danger ? C.danger : C.accent} disabled={busy} onClick={() => void onYes()}>
        {yes}
      </button>
      <button type={C.button} className={C.secondary} onClick={onNo}>
        {no}
      </button>
    </div>
  );
}
