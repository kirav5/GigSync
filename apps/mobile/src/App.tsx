import { Agent, ownerPorts } from "@gigsync/core";
import type { City, Lang, QrCode, UserId } from "@gigsync/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Account, AccountRole, deviceFor, loadAccount, raiseDeviceProtocol, signOut } from "./adapters/account.js";
import { keepBackInApp, onBackButton } from "./adapters/back.js";
import { loadLang, saveLang, suggestedLang } from "./adapters/lang.js";
import { chosenModel } from "./adapters/model.js";
import { createPorts } from "./adapters/ports.js";
import { forgetCloudConsent } from "./adapters/speech-settings.js";
import { fetchPacksOnTap, prepareLanguage } from "./adapters/translate.js";
import type { ChosenWorker } from "./find/ask.js";
import { endNeed } from "./find/needStore.js";
import { I18nProvider } from "./i18n.js";
import { useOpenedQr } from "./qr/useOpenedQr.js";
import { Shell, SUB_SCREENS } from "./Shell.js";
import { AgentScreen } from "./screens/Agent.js";
import { Find } from "./screens/Find.js";
import { Landing } from "./screens/Landing.js";
import { LanguageChooser } from "./screens/Language.js";
import { MyCard } from "./screens/MyCard.js";
import { FindMentor } from "./screens/mentor/FindMentor.js";
import { LinkScreen } from "./screens/mentor/LinkScreen.js";
import { LinksProvider } from "./screens/mentor/links.js";
import { Passbook } from "./screens/Passbook.js";
import { MyQr } from "./screens/qr/MyQr.js";
import { Person } from "./screens/qr/Person.js";
import { Requests } from "./screens/Requests.js";
import { Settings } from "./screens/Settings.js";
import { SignIn } from "./screens/SignIn.js";
import { Today } from "./screens/Today.js";
import { CardState, Screen } from "./state.js";
import { forgetTalk, loadTalk } from "./talk/talkStore.js";
import { Frame } from "./ui/Frame.js";
import { CONSUMER_TABS, WORKER_TABS } from "./ui/Tabs.js";
import { useGig } from "./useGig.js";

/**
 * Where an owner lands, and where Back leads from any other tab: a consumer on Find; a worker on Today once they have
 * a card (even one off the board), and on Talk, to make one by talking, before that.
 */
function landing(account: Account): Screen {
  if (account.role === AccountRole.consumer) return Screen.find;
  return account.worker ? Screen.today : Screen.talk;
}

function cardState(account: Account): CardState {
  if (!account.worker) return CardState.none;
  return account.listed === false ? CardState.off : CardState.on;
}

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
    },
    [ports],
  );
  const { view, run } = useGig(owned, device);
  const [screen, setScreen] = useState<Screen>(Screen.find);
  /** Talk opens on the card interview: set by every way into it, cleared once the card is published. */
  const [interview, setInterview] = useState(false);
  /** Whose mentor link is open on its own screen. */
  const [openLink, setOpenLink] = useState<UserId>();
  /** The city of the move Talk is about, for the moving checklist (the landing journey) to start with. */
  const [movingTo, setMovingTo] = useState<City>();
  /** The QR code whose owner the person screen shows, and a worker chosen from a QR or an offer for Find to ask. */
  const [personCode, setPersonCode] = useState<QrCode>();
  const [chosen, setChosen] = useState<ChosenWorker>();
  const showPerson = useCallback((code: QrCode) => {
    setPersonCode(code);
    setScreen(Screen.person);
  }, []);
  // A QR link the phone's camera opened: whoever it finds, once someone is signed in.
  useOpenedQr(!!account && !!device, showPerson);

  const land = useCallback((a: Account) => {
    const home = landing(a);
    setScreen(home);
    setInterview(home === Screen.talk);
  }, []);

  useEffect(() => {
    void loadLang(ports).then((l) => setLangState(l ?? null));
    void loadAccount(ports).then((a) => {
      setAccount(a ?? null);
      if (a) land(a);
      if (a) void raiseDeviceProtocol(ports, a);
    });
  }, [ports, land]);

  useEffect(() => {
    void chosenModel.load(ports.storage);
  }, [ports]);

  // Talk's chats are the owner's: read once they are signed in, from their records on this phone.
  useEffect(() => {
    if (owner) void loadTalk(owned);
  }, [owner, owned]);

  // Back (Android's button, the browser's, or the one on screen): a sub-screen back to its tab, any other tab back to
  // the landing one, and from there the app goes to the background, or the browser leaves. One listener for the app's life, reading the current screen
  // through a ref, so a press can never land between removing one listener and adding the next.
  const back = useRef<() => boolean>(() => false);
  useEffect(() => {
    back.current = () => {
      if (!account) return false;
      const to = SUB_SCREENS[screen]?.parent ?? landing(account);
      if (to === screen) return false;
      setScreen(to);
      return true;
    };
  });
  // A line waiting for a language pack has it fetched on the owner's next tap anywhere.
  useEffect(() => fetchPacksOnTap(), []);
  useEffect(() => onBackButton(() => back.current()), []);
  useEffect(() => keepBackInApp(account ? screen !== landing(account) : false), [account, screen]);

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
              onLanguage={() => setLangState(null)}
              onSignedIn={(a) => {
                setAccount(a);
                land(a);
              }}
            />
          </I18nProvider>
        )}
      </Frame>
    );
  }

  const isWorker = account.role === AccountRole.worker;
  const saved = (a: Account) => {
    setAccount(a);
    setInterview(false);
  };
  const talkCard = () => {
    setInterview(true);
    setScreen(Screen.talk);
  };
  const openLanding = (city: City) => {
    setMovingTo(city);
    setScreen(Screen.landing);
  };
  const showLink = (user: UserId) => {
    setOpenLink(user);
    setScreen(Screen.link);
  };
  const askFor = (worker: ChosenWorker) => {
    setChosen(worker);
    setScreen(Screen.find);
  };
  const toScreen = (s: Screen) => {
    setChosen(undefined);
    setScreen(s);
  };
  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <LinksProvider device={device} syncedAt={view.syncedAt}>
        <Shell
          tabs={isWorker ? WORKER_TABS : CONSUMER_TABS}
          screen={screen}
          onScreen={toScreen}
          onBack={() => back.current()}
          tasks={view.tasks.length + view.offers.length}
        >
          {screen === Screen.find && (
            <Find
              ports={owned}
              account={account}
              device={device}
              chosen={chosen}
              onAsked={() => toScreen(Screen.requests)}
            />
          )}
          {screen === Screen.requests && <Requests view={view} device={device} run={run} onAsk={askFor} />}
          {screen === Screen.today && (
            <Today
              ports={owned}
              view={view}
              device={device}
              run={run}
              card={cardState(account)}
              onMakeCard={talkCard}
              onOpenCard={() => setScreen(Screen.card)}
              onAddPayee={() => setScreen(Screen.profile)}
              account={account}
            />
          )}
          {screen === Screen.talk && (
            <AgentScreen
              agent={agent}
              ports={owned}
              account={account}
              interview={interview}
              onSaved={saved}
              onChecklist={openLanding}
              onFindMentor={() => setScreen(Screen.findMentor)}
              view={view}
              device={device}
              run={run}
            />
          )}
          {screen === Screen.passbook && (
            <Passbook
              view={view}
              me={account.session.user}
              device={device}
              run={run}
              onAddPayee={() => setScreen(Screen.profile)}
            />
          )}
          {screen === Screen.profile && (
            <Settings
              ports={owned}
              account={account}
              isWorker={isWorker}
              onSignOut={() =>
                // Their records stay on the phone under their name, for when they sign in again.
                void signOut(ports).then(() => {
                  // Talk's chats stay on the phone under their name, off the screen. Find's chat (not yet saved) and
                  // the companies they let hear them were theirs alone.
                  forgetTalk();
                  endNeed();
                  forgetCloudConsent();
                  setAccount(null);
                })
              }
              onCard={() => setScreen(Screen.card)}
              onTalkCard={talkCard}
              onOpenLink={showLink}
              onMyQr={() => setScreen(Screen.myQr)}
            />
          )}
          {screen === Screen.myQr && <MyQr account={account} onScanned={showPerson} />}
          {screen === Screen.person && personCode && (
            <Person account={account} device={device} run={run} code={personCode} onAsk={askFor} />
          )}
          {screen === Screen.findMentor && (
            <FindMentor ports={owned} account={account} device={device} run={run} syncedAt={view.syncedAt} />
          )}
          {screen === Screen.landing && (
            <Landing
              ports={owned}
              account={account}
              jobs={view.jobs}
              city={movingTo}
              onFindMentor={() => setScreen(Screen.findMentor)}
            />
          )}
          {screen === Screen.card && <MyCard ports={owned} account={account} onSaved={saved} onTalk={talkCard} />}
          {screen === Screen.link && (
            <LinkScreen
              device={device}
              run={run}
              syncedAt={view.syncedAt}
              user={openLink}
              onGone={() => setScreen(Screen.profile)}
            />
          )}
        </Shell>
      </LinksProvider>
    </I18nProvider>
  );
}
