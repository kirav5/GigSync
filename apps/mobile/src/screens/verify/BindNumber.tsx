import { bindingFits, HttpError, type MessageKey, type MobileEvidence, type Storage } from "@gigsync/core";
import { useEffect, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { bindTriesToday, countBindTry, MAX_BIND_TRIES } from "../../adapters/idcheck.js";
import { confirmPhoneCode, sendConfirmCode } from "../../adapters/phoneCode.js";
import { useI18n } from "../../i18n.js";
import { CODE_LENGTH, CodeBoxes, DEV_CODE } from "../../ui/CodeBoxes.js";
import { C } from "../../ui/cls.js";
import { INDIA } from "../../ui/countries.js";
import { errorKey } from "../../ui/errorKey.js";
import { phoneE164, shownNumber, typedNumber } from "../../ui/phone.js";
import { CodeActions } from "../start/CodeStep.js";

/** The server's answer to a wrong code. */
const WRONG_CODE = 401;
const NUMBER_FIELD = "aadhaar-mobile";
const CODE_FIELD = "aadhaar-mobile-code";
const PLACEHOLDER = typedNumber("0".repeat(INDIA.digits[1]), INDIA);
const PLUS = "+";

/**
 * The Aadhaar is genuine but linked to a number other than the one they signed in with: they type that number, the
 * phone checks it against the Aadhaar's hash or last 4 digits (core/identity, in memory), and only a number that fits
 * gets GigSync's own SMS code; the code proves they hold it (POST /v1/phone/confirm), without signing in with it. A
 * number that does not fit counts as a try: 3 a day, then the check stops until tomorrow. The number is never kept.
 * An Aadhaar's mobile is always Indian, so the field is India's.
 */
export function BindNumber({
  storage,
  account,
  mobile,
  onBound,
  onBack,
}: {
  storage: Storage;
  account: Account;
  mobile: MobileEvidence;
  onBound: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [sentAt, setSentAt] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ key: MessageKey; left?: number }>();
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    void bindTriesToday(storage, new Date()).then((tries) => setStopped(tries >= MAX_BIND_TRIES));
  }, [storage]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setProblem(undefined);
    try {
      await work();
    } catch (err) {
      setProblem({
        key: err instanceof HttpError && err.status === WRONG_CODE ? "idcheck.other_code_wrong" : errorKey(err),
      });
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function checkNumber() {
    const phone = phoneE164(typed, INDIA);
    if (!phone) return setProblem({ key: "signin.err_phone" });
    await run(async () => {
      if (!bindingFits(await mobile.matches(phone))) {
        const tries = await countBindTry(storage, new Date());
        if (tries >= MAX_BIND_TRIES) return setStopped(true);
        return setProblem({ key: "idcheck.other_wrong", left: MAX_BIND_TRIES - tries });
      }
      await sendConfirmCode(phone, account.session);
      setSentTo(phone);
      setSentAt(Date.now());
    });
  }

  function enter(digits: string) {
    setCode(digits);
    if (sentTo && digits.length === CODE_LENGTH)
      void run(async () => {
        await confirmPhoneCode(sentTo, digits, account.session);
        onBound();
      });
  }

  const line = problem && (
    <p className={C.error} role="alert">
      {t(problem.key, { left: problem.left ?? 0 })}
    </p>
  );

  if (sentTo)
    return (
      <section className={`${C.stack} verify`} aria-label={t("idcheck.other_code_title")}>
        <h1 className="verify-title">{t("idcheck.other_code_title")}</h1>
        <p className={C.muted}>{t("idcheck.other_code_sent", { phone: shownNumber(sentTo, INDIA) })}</p>
        <CodeBoxes name={CODE_FIELD} label={t("signin.code")} code={code} busy={busy} onCode={enter} />
        {import.meta.env.DEV && <p className="fine">{t("signin.code_dev", { code: DEV_CODE })}</p>}
        {line}
        <CodeActions busy={busy} sentAt={sentAt} onResend={() => void checkNumber()} />
        <button type={C.button} className={C.secondary} onClick={() => setSentTo(undefined)}>
          {t("start.change_number")}
        </button>
      </section>
    );

  return (
    <form
      className={`${C.stack} verify`}
      aria-label={t("idcheck.other_title")}
      onSubmit={(e) => {
        e.preventDefault();
        void checkNumber();
      }}
    >
      <h1 className="verify-title">{t("idcheck.other_title")}</h1>
      <p className={C.muted}>{t("idcheck.other_line")}</p>
      <label className={`${C.fieldLabel} verify-number`}>
        <span className={C.muted}>{t("idcheck.other_number")}</span>
        <span className="verify-phone">
          <span className="verify-dial" aria-hidden="true">{`${PLUS}${INDIA.dial}`}</span>
          <input
            className={C.field}
            name={NUMBER_FIELD}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={PLACEHOLDER}
            disabled={stopped}
            value={typed}
            onChange={(e) => setTyped(typedNumber(e.target.value, INDIA))}
          />
        </span>
      </label>
      {stopped ? (
        <p className={C.error} role="alert">
          {t("idcheck.other_stop")}
        </p>
      ) : (
        line
      )}
      <button type={C.submit} className={`${C.wide} btn-big`} disabled={busy || stopped || !typed} aria-busy={busy}>
        {t("idcheck.other_send")}
      </button>
      <button type={C.button} className={C.secondary} onClick={onBack}>
        {t("idcheck.back")}
      </button>
    </form>
  );
}
