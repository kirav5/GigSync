import { Agent, ownerPorts } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Account, deviceFor, loadAccount, raiseDeviceProtocol, signOut } from "./adapters/account.js";
import { keepBackInApp, onBackButton } from "./adapters/back.js";
import { understanding } from "./adapters/embedder.js";
import { loadLang, saveLang, suggestedLang } from "./adapters/lang.js";
import { chosenModel } from "./adapters/model.js";
import { createPorts } from "./adapters/ports.js";
import { prepareListening } from "./adapters/speech.js";
import { forgetCloudConsent } from "./adapters/speech-settings.js";
import { fetchPacksOnTap, prepareLanguage } from "./adapters/translate.js";
import { forgetFind, loadFind } from "./find/findChats.js";
import { I18nProvider } from "./i18n.js";
import { LanguageChooser } from "./screens/Language.js";
import { SignIn } from "./screens/SignIn.js";
import { setDrawer } from "./shell/drawer.js";
import { SignedIn } from "./shell/SignedIn.js";
import { forgetTalk, loadTalk } from "./talk/talkStore.js";
import { Frame } from "./ui/Frame.js";
import { useGig } from "./useGig.js";

/** GigSync on one phone: sign in, then a consumer finds and asks, a worker is found and answers; agents negotiate. */
export function App() {
  const ports = useMemo(createPorts, []);
  const [account, setAccount] = useState<Account | null>();
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
      // And its voice typing, where the phone can fetch it.
      prepareListening(next);
    },
    [ports],
  );
  const { view, run } = useGig(owned, device);

  useEffect(() => {
    void loadLang(ports).then((l) => setLangState(l ?? null));
    void loadAccount(ports).then((a) => {
      setAccount(a ?? null);
      if (a) void raiseDeviceProtocol(ports, a);
    });
  }, [ports]);

  useEffect(() => {
    void chosenModel.load(ports.storage);
    // The understanding pack loads from the cache only when the owner fetched it before (ADR 0042).
    void understanding.load(ports.storage);
  }, [ports]);

  // Talk's and Find's chats are the owner's: read once they are signed in, from their records on this phone.
  useEffect(() => {
    if (!owner) return;
    void loadTalk(owned);
    void loadFind(owned);
  }, [owner, owned]);

  // Back (Android's button, the browser's, or the one on screen): the signed-in screens move back one place
  // (shell/SignedIn.tsx), and from the chat the app goes to the background, or the browser leaves. One listener for
  // the app's life, reading the current handler through a ref, so a press never lands between two listeners.
  const back = useRef<() => boolean>(() => false);
  // A line waiting for a language pack has it fetched on the owner's next tap anywhere.
  useEffect(() => fetchPacksOnTap(), []);
  useEffect(() => onBackButton(() => back.current()), []);
  useEffect(() => {
    if (!account) keepBackInApp(false);
  }, [account]);

  if (account === undefined || lang === undefined) return null;
  if (lang === null || account === null || !device) {
    return (
      <Frame>
        {lang === null ? (
          <LanguageChooser suggested={suggestedLang()} onChoose={setLang} />
        ) : (
          <I18nProvider lang={lang} setLang={setLang}>
            <SignIn ports={ports} onLanguage={() => setLangState(null)} onSignedIn={setAccount} />
          </I18nProvider>
        )}
      </Frame>
    );
  }

  const signOutNow = () =>
    // Their records stay on the phone under their name, for when they sign in again.
    void signOut(ports).then(() => {
      // Talk's and Find's chats stay on the phone under their name, off the screen. The companies they let hear
      // them were theirs alone.
      forgetTalk();
      forgetFind();
      forgetCloudConsent();
      setDrawer(false);
      setAccount(null);
    });
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
