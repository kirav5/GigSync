import { Agent, ownerPorts } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Account,
  deviceFor,
  endSession,
  loadAccount,
  raiseDeviceProtocol,
  signInAgainNumber,
  signOut,
} from "./adapters/account.js";
import { keepBackInApp, onBackButton } from "./adapters/back.js";
import { understanding } from "./adapters/embedder.js";
import { loadLang, saveLang, suggestedLang } from "./adapters/lang.js";
import { setMapSession } from "./adapters/map.js";
import { chosenModel } from "./adapters/model.js";
import { createPorts } from "./adapters/ports.js";
import { onSessionEnded } from "./adapters/session-end.js";
import { forgetCloudConsent } from "./adapters/speech-settings.js";
import { fetchPacksOnTap, prepareLanguage } from "./adapters/translate.js";
import { forgetFind, loadFind } from "./find/findChats.js";
import { I18nProvider } from "./i18n.js";
import { LanguageChooser } from "./screens/Language.js";
import { SignIn } from "./screens/start/SignIn.js";
import { SignedIn } from "./shell/SignedIn.js";
import { forgetTalk, loadTalk } from "./talk/talkStore.js";
import { Frame } from "./ui/Frame.js";
import { useGig } from "./useGig.js";

/** GigSync on one phone: sign in, then a consumer finds and asks, a worker is found and answers; agents negotiate. */
export function App() {
  const ports = useMemo(createPorts, []);
  const [account, setAccount] = useState<Account | null>();
  /** The number whose session the server stopped taking, for sign-in to open on; none after a sign-out. */
  const [again, setAgain] = useState<string>();
  const owner = account?.session.user;
  /**
   * What the signed-in owner's agent and screens use: this phone, with its storage seen as theirs alone, so a shared
   * phone never shows one owner's jobs, money or memory to the next. Signed out, only the phone's own settings are read.
   */
  const owned = useMemo(() => (owner ? ownerPorts(ports, owner) : ports), [ports, owner]);
  const agent = useMemo(() => new Agent(owned), [owned]);
  /** undefined while loading; null until the owner picks one on the first screen. */
  const [lang, setLangState] = useState<Lang | null>();
  const device = useMemo(() => (account && lang ? deviceFor(owned, account, lang) : undefined), [owned, account, lang]);
  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      void saveLang(ports, next);
      // Picked with a tap, the one moment engines allow a download: other people's words are ready in it.
      prepareLanguage(next);
      // Not its voice typing: Android asks before a 100 MB download, which belongs to the first tap on the mic.
    },
    [ports],
  );
  const { view, run } = useGig(owned, device);

  useEffect(() => {
    void loadLang(ports).then((l) => setLangState(l ?? null));
    void loadAccount(ports).then(async (a) => {
      if (!a) setAgain(await signInAgainNumber(ports));
      setAccount(a ?? null);
      if (a) void raiseDeviceProtocol(ports, a);
    });
  }, [ports]);

  useEffect(() => {
    void chosenModel.load(ports.storage);
    // The understanding pack loads from the cache only when the owner fetched it before (ADR 0042).
    void understanding.load(ports.storage);
  }, [ports]);

  // The map asks the API with the signed-in owner's session (ADR 0050 §7); none once signed out.
  useEffect(() => {
    setMapSession(account?.session);
  }, [account]);

  // Talk's and Find's chats are the owner's: read once they are signed in, from their records on this phone.
  useEffect(() => {
    if (!owner) return;
    void loadTalk(owned);
    void loadFind(owned);
  }, [owner, owned]);

  // Back (Android's button, the browser's, or the one on screen): the signed-in screens move back one place
  // (shell/useNav.ts), and from the landing screen the app goes to the background, or the browser leaves. One
  // listener for the app's life, reading the current handler through a ref, so a press never lands between two.
  const back = useRef<() => boolean>(() => false);
  // A line waiting for a language pack has it fetched on the owner's next tap anywhere.
  useEffect(() => fetchPacksOnTap(), []);
  useEffect(() => onBackButton(() => back.current()), []);
  useEffect(() => {
    if (!account) keepBackInApp(false);
  }, [account]);

  /** Off the screen once the account is gone from the phone, by sign-out or by a session that ended. */
  const signedOut = useCallback(() => {
    // Talk's and Find's chats stay on the phone under their name, off the screen. The companies they let hear them
    // were theirs alone.
    forgetTalk();
    forgetFind();
    forgetCloudConsent();
    setAccount(null);
  }, []);
  // Their records stay on the phone under their name, for when they sign in again.
  const signOutNow = useCallback(() => void signOut(ports).then(signedOut), [ports, signedOut]);
  // A session the server no longer takes (expired, the device retired, or the server lost it) opens sign-in on the same
  // number with "Sign in again", once; a reload in between keeps it, as the number is saved.
  const sessionEnded = useCallback(() => {
    const phone = account?.contact.phone;
    void endSession(ports).then(() => {
      setAgain(phone);
      signedOut();
    });
  }, [ports, account, signedOut]);
  useEffect(() => (account ? onSessionEnded(sessionEnded) : undefined), [account, sessionEnded]);

  if (account === undefined || lang === undefined) return null;
  if (lang === null || account === null || !device) {
    return (
      <Frame>
        {lang === null ? (
          <LanguageChooser suggested={suggestedLang()} onChoose={setLang} />
        ) : (
          <I18nProvider lang={lang} setLang={setLang}>
            <SignIn
              ports={ports}
              again={again}
              onLanguage={() => setLangState(null)}
              onSignedIn={(a) => {
                setAgain(undefined);
                setAccount(a);
              }}
            />
          </I18nProvider>
        )}
      </Frame>
    );
  }

  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <SignedIn
        key={account.session.user}
        agent={agent}
        ports={owned}
        account={account}
        device={device}
        view={view}
        run={run}
        onAccount={setAccount}
        onSignOut={signOutNow}
        back={back}
      />
    </I18nProvider>
  );
}
