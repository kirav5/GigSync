import { log, type MessageKey, type Ports } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { type Account, type AccountRole, sendCode, signIn } from "../../adapters/account.js";
import { agreeAtSignIn } from "../../adapters/records.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { errorKey } from "../../ui/errorKey.js";
import { phoneE164 } from "../../ui/phone.js";
import { TermsPage } from "../pages/TermsPage.js";
import { CodeActions, CodeStep } from "./CodeStep.js";
import { CODE_LENGTH, FORM_ID, Step } from "./form.js";
import { NumberActions, NumberStep } from "./NumberStep.js";
import { RoleStep } from "./RoleStep.js";
import "./start.css";

/**
 * Sign-in as three short steps in one form: who you are, your number (and name), the code from the SMS. What was
 * typed lives here, so a step back, or the terms page, never loses it. The code goes to the server; this phone's
 * private keys never do.
 */
export function SignIn({
  ports,
  onSignedIn,
  onLanguage,
}: {
  ports: Ports;
  onSignedIn: (a: Account) => void;
  /** Back to the first screen to pick another language. */
  onLanguage: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(Step.role);
  const [role, setRole] = useState<AccountRole>();
  const [name, setName] = useState("");
  const [typed, setTyped] = useState("");
  /** The number the code went to, in the form the server takes. */
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey>();
  const [note, setNote] = useState<MessageKey>();
  const [terms, setTerms] = useState(false);

  /** Runs one call to the server, the dock saying what is under way (`doing`) or why it failed; true when it went through. */
  async function run(work: () => Promise<void>, doing?: MessageKey): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    setNote(doing);
    try {
      await work();
      return true;
    } catch (err) {
      log.warn("sign-in failed", { error: err instanceof Error ? err.message : String(err) });
      setError(errorKey(err));
      return false;
    } finally {
      setBusy(false);
      if (doing) setNote(undefined);
    }
  }

  function chooseRole(next: AccountRole) {
    setRole(next);
    setStep(Step.number);
  }

  async function send() {
    const phone = phoneE164(typed);
    if (!phone) return setError("signin.err_phone");
    await run(async () => {
      await sendCode(phone);
      setSentTo(phone);
      setCode("");
      setStep(Step.code);
    });
  }

  function resend() {
    if (!sentTo) return;
    void run(() => sendCode(sentTo)).then((sent) => sent && setNote("start.code_resent"));
  }

  async function verify(digits: string) {
    if (!sentTo || !role || busy) return;
    const signedIn = await run(async () => {
      // No address here (ADR 0045): a household saves addresses in Find or Me, and picks one per request.
      const contact = { name: name.trim(), phone: sentTo };
      const account = await signIn(ports, { phone: sentTo, code: digits, role, contact });
      await agreeAtSignIn(ports, account);
      onSignedIn(account);
    }, "start.signing_in");
    // A wrong or refused code is typed again from the first box.
    if (!signedIn) setCode("");
  }

  /** Each number typed; the last one signs in. */
  function enter(digits: string) {
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  function back() {
    setError(undefined);
    setNote(undefined);
    setStep(step === Step.code ? Step.number : Step.role);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === Step.number) void send();
    else if (step === Step.code && code.length === CODE_LENGTH) void verify(code);
  }

  const status = error ?? note;
  // The form stays mounted under the terms, so the step and what the owner typed are still there when they come back.
  return (
    <>
      {terms && <TermsPage onBack={() => setTerms(false)} />}
      <form id={FORM_ID} className={`${C.stack} start`} hidden={terms} onSubmit={submit} aria-label={t("signin.label")}>
        {step === Step.role && <RoleStep role={role} onRole={chooseRole} onLanguage={onLanguage} />}
        {step === Step.number && role && (
          <NumberStep role={role} name={name} phone={typed} onName={setName} onPhone={setTyped} onBack={back} />
        )}
        {step === Step.code && <CodeStep phone={typed} code={code} busy={busy} onCode={enter} onBack={back} />}
      </form>
      {!terms && step !== Step.role && (
        <Dock>
          <p className={error ? C.dockError : C.dockStatus} role="status" aria-live="polite">
            {status && t(status)}
          </p>
          {step === Step.number ? (
            <NumberActions busy={busy} onTerms={() => setTerms(true)} />
          ) : (
            <CodeActions busy={busy} onResend={resend} onChange={back} />
          )}
        </Dock>
      )}
    </>
  );
}
