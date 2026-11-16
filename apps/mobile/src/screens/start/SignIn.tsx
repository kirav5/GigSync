import { log, type MessageKey, type Ports } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { type Account, type AccountRole, forgetSignInAgain } from "../../adapters/account.js";
import { agreeAtSignIn } from "../../adapters/records.js";
import { accountFor, needsName, saveSignedIn, sendCode, type Verified, verifyNumber } from "../../adapters/signin.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { type Country, INDIA } from "../../ui/countries.js";
import { Dock } from "../../ui/Dock.js";
import { errorKey } from "../../ui/errorKey.js";
import { phoneE164, shownNumber, typedFrom } from "../../ui/phone.js";
import { TermsPage } from "../pages/TermsPage.js";
import { CodeStep } from "./CodeStep.js";
import { CODE_LENGTH, FORM_ID, Step } from "./form.js";
import { NameActions, NameStep } from "./NameStep.js";
import { NumberActions, NumberStep } from "./NumberStep.js";
import { RoleStep } from "./RoleStep.js";
import { WelcomeActions, WelcomeStep } from "./WelcomeStep.js";
import "./start.css";

/** Under the number's title when the server stopped taking this phone's session: why sign-in is back. */
const SIGNED_OUT_NOTICE: MessageKey = "start.signin_again";

/** Each step's place in the dots at the top; the welcome has none. */
const STEP_NUMBER: Readonly<Record<Step, number>> = { welcome: 0, number: 1, code: 2, role: 3, name: 4 };

/**
 * Sign-in as short steps in one form: the welcome with the agreement line, the number, the code from the SMS, then,
 * for a number this phone keeps nothing for, find work or find help and the name. A returning number goes straight in
 * with the side and name it had. What was typed lives here, so a step back, or the terms page, never loses it. The
 * code goes to the server; this phone's private keys never do. `again` is the number whose session the server stopped
 * taking: sign-in opens on it, with a line under the title saying why.
 */
export function SignIn({
  ports,
  again,
  onSignedIn,
  onLanguage,
}: {
  ports: Ports;
  again?: string | undefined;
  onSignedIn: (a: Account) => void;
  /** Back to the first screen to pick another language. */
  onLanguage: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(again ? Step.number : Step.welcome);
  const [role, setRole] = useState<AccountRole>();
  const [name, setName] = useState("");
  const [typed, setTyped] = useState(() => (again ? typedFrom(again).typed : ""));
  const [country, setCountry] = useState<Country>(() => (again ? typedFrom(again).country : INDIA));
  /** The number the code went to, in the form the server takes, and when it was last sent. */
  const [sentTo, setSentTo] = useState<string>();
  const [sentAt, setSentAt] = useState(0);
  /** A number verified that this phone keeps nothing for: waits on find work or find help. */
  const [verified, setVerified] = useState<Verified>();
  /** Signed in with a number this phone has no name for: waits on the name step. */
  const [unnamed, setUnnamed] = useState<Account>();
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

  async function send() {
    const phone = phoneE164(typed, country);
    if (!phone) return setError(country === INDIA ? "signin.err_phone" : "signin.err_phone_other");
    await run(async () => {
      await sendCode(phone);
      setSentTo(phone);
      setSentAt(Date.now());
      setCode("");
      setStep(Step.code);
    });
  }

  function resend() {
    if (!sentTo) return;
    void run(() => sendCode(sentTo)).then((sent) => {
      if (!sent) return;
      setSentAt(Date.now());
      setNote("start.code_resent");
    });
  }

  async function verify(digits: string) {
    if (!sentTo || busy) return;
    const signedIn = await run(async () => {
      // No address here (ADR 0045): a household saves addresses in Find or Me, and picks one per request.
      const checked = await verifyNumber(ports, { phone: sentTo, code: digits });
      const account = accountFor(checked);
      if (!account) {
        setVerified(checked);
        return setStep(Step.role);
      }
      if (!needsName(account)) return finish(await saveSignedIn(ports, account));
      setUnnamed(account);
      setStep(Step.name);
    }, "start.signing_in");
    // A wrong or refused code is typed again from the first box.
    if (!signedIn) setCode("");
  }

  function chooseRole(next: AccountRole) {
    if (!verified) return;
    setRole(next);
    setUnnamed(accountFor(verified, next));
    setStep(Step.name);
  }

  async function finish(account: Account) {
    await forgetSignInAgain(ports);
    await agreeAtSignIn(ports, account);
    onSignedIn(account);
  }

  function saveName() {
    const given = name.trim();
    if (!unnamed || !given) return;
    void run(async () => finish(await saveSignedIn(ports, unnamed, given)));
  }

  /** Each number typed; the last one signs in. */
  function enter(digits: string) {
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  /** One step back: the code to the number, the number to the welcome, the name to the two choices. */
  function back() {
    setError(undefined);
    setNote(undefined);
    if (step === Step.code) setStep(Step.number);
    else if (step === Step.name) setStep(Step.role);
    else setStep(Step.welcome);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === Step.number) void send();
    else if (step === Step.code && code.length === CODE_LENGTH) void verify(code);
    else if (step === Step.name) saveName();
  }

  const status = error ?? note;
  // The form stays mounted under the terms, so the step and what the owner typed are still there when they come back.
  return (
    <>
      {terms && <TermsPage onBack={() => setTerms(false)} />}
      <form
        key={step}
        id={FORM_ID}
        className={`${C.stack} start`}
        hidden={terms}
        onSubmit={submit}
        aria-label={t("signin.label")}
      >
        {step === Step.welcome && <WelcomeStep onLanguage={onLanguage} />}
        {step === Step.number && (
          <NumberStep
            step={STEP_NUMBER.number}
            phone={typed}
            onPhone={setTyped}
            country={country}
            onCountry={setCountry}
            onBack={back}
            notice={again ? SIGNED_OUT_NOTICE : undefined}
          />
        )}
        {step === Step.code && (
          <CodeStep
            step={STEP_NUMBER.code}
            phone={sentTo ? shownNumber(sentTo, country) : typed}
            code={code}
            busy={busy}
            sentAt={sentAt}
            onCode={enter}
            onResend={resend}
            onBack={back}
          />
        )}
        {step === Step.role && <RoleStep step={STEP_NUMBER.role} role={role} onRole={chooseRole} />}
        {step === Step.name && unnamed && (
          <NameStep role={unnamed.role} name={name} onName={setName} {...(verified ? { onBack: back } : {})} />
        )}
      </form>
      {!terms && step !== Step.role && (
        <Dock>
          <p className={error ? C.dockError : C.dockStatus} role="status" aria-live="polite">
            {status && t(status)}
          </p>
          {step === Step.welcome && (
            <WelcomeActions onStart={() => setStep(Step.number)} onTerms={() => setTerms(true)} />
          )}
          {step === Step.number && <NumberActions busy={busy} />}
          {step === Step.name && <NameActions busy={busy} />}
        </Dock>
      )}
    </>
  );
}
