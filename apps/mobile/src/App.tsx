import { Agent } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Account, AccountRole, deviceFor, loadAccount, signOut } from "./adapters/account.js";
import { apiReachable } from "./adapters/api.js";
import { keepBackInApp, onBackButton } from "./adapters/back.js";
import { loadLang, saveLang, suggestedLang } from "./adapters/lang.js";
import { chosenModel } from "./adapters/model.js";
import { createPorts } from "./adapters/ports.js";
import { forgetCloudConsent } from "./adapters/speech-settings.js";
import { endInterview } from "./card/interviewStore.js";
import { I18nProvider } from "./i18n.js";
import { Shell, SUB_SCREENS, WORKER_SUB_SCREENS } from "./Shell.js";
import { AgentScreen } from "./screens/Agent.js";
import { Colleagues } from "./screens/Colleagues.js";
import { ColleagueProvider } from "./screens/colleague/context.js";
import { COLLEAGUE_LIST, type ColleaguePlace } from "./screens/colleague/place.js";
import { Find } from "./screens/Find.js";
import { LanguageChooser } from "./screens/Language.js";
import { MyCard } from "./screens/MyCard.js";
import { Passbook } from "./screens/Passbook.js";
import { Requests } from "./screens/Requests.js";
import { Settings } from "./screens/Settings.js";
import { SignIn } from "./screens/SignIn.js";
import { Today } from "./screens/Today.js";
import { CardState, Screen } from "./state.js";
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
  const agent = useMemo(() => new Agent(ports), [ports]);
  const [account, setAccount] = useState<Account | null>();
  /** undefined while loading; null until the owner picks one on the first screen. */
  const [lang, setLangState] = useState<Lang | null>();
  const device = useMemo(() => (account && lang ? deviceFor(ports, account, lang) : undefined), [ports, account, lang]);
  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      void saveLang(ports, next);
    },
    [ports],
  );
  const { view, run } = useGig(ports, device);
  const [screen, setScreen] = useState<Screen>(Screen.find);
  /** Talk opens on the card interview: set by every way into it, cleared once the card is published. */
  const [interview, setInterview] = useState(false);
  const [platform, setPlatform] = useState("web");
  const [online, setOnline] = useState<boolean>();
  const [colleaguePlace, setColleaguePlace] = useState<ColleaguePlace>(COLLEAGUE_LIST);
  const subs = account?.role === AccountRole.worker ? WORKER_SUB_SCREENS : SUB_SCREENS;

  const land = useCallback((a: Account) => {
    const home = landing(a);
    setScreen(home);
    setInterview(home === Screen.talk);
  }, []);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setPlatform(Capacitor.getPlatform()));
    void apiReachable().then(setOnline);
    void loadLang(ports).then((l) => setLangState(l ?? null));
    void loadAccount(ports).then((a) => {
      setAccount(a ?? null);
      if (a) land(a);
    });
  }, [ports, land]);

  useEffect(() => {
    void chosenModel.load(ports.storage);
  }, [ports]);

  // Back (Android's button, the browser's, or the one on screen): a colleague's notes, code or scanner opened from the
  // Colleagues list back to it, a sub-screen back to its tab, any other tab back to the landing one, and from there the
  // app goes to the background, or the browser leaves. One listener for the app's life, reading the current screen
  // through a ref, so a press can never land between removing one listener and adding the next.
  const back = useRef<() => boolean>(() => false);
  useEffect(() => {
    back.current = () => {
      if (!account) return false;
      if (screen === Screen.colleagues && colleaguePlace.fromList) {
        setColleaguePlace(COLLEAGUE_LIST);
        return true;
      }
      const to = subs[screen]?.parent ?? landing(account);
      if (to === screen) return false;
      setScreen(to);
      return true;
    };
  });
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
  const openColleagues = (place: ColleaguePlace) => {
    setColleaguePlace(place);
    setScreen(Screen.colleagues);
  };
  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <ColleagueProvider ports={ports} device={device} syncedAt={view.syncedAt}>
        <Shell
          tabs={isWorker ? WORKER_TABS : CONSUMER_TABS}
          subs={subs}
          screen={screen}
          onScreen={setScreen}
          onBack={() => back.current()}
          tasks={view.tasks.length}
        >
          {screen === Screen.find && (
            <Find
              ports={ports}
              account={account}
              device={device}
              hire={isWorker}
              onAccount={setAccount}
              // A worker's hire is followed on Today, under You hired; a household's request on My jobs.
              onAsked={() => setScreen(isWorker ? Screen.today : Screen.requests)}
            />
          )}
          {screen === Screen.requests && <Requests view={view} device={device} run={run} />}
          {screen === Screen.today && (
            <Today
              ports={ports}
              view={view}
              device={device}
              run={run}
              card={cardState(account)}
              onMakeCard={talkCard}
              onOpenCard={() => setScreen(Screen.card)}
              onAddPayee={() => setScreen(Screen.profile)}
            />
          )}
          {screen === Screen.talk && (
            <AgentScreen
              agent={agent}
              ports={ports}
              account={account}
              interview={interview}
              onSaved={saved}
              onHire={() => setScreen(Screen.find)}
              view={view}
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
              ports={ports}
              account={account}
              isWorker={isWorker}
              platform={platform}
              online={online}
              onSignOut={() =>
                void signOut(ports).then(() => {
                  // What they told the card interview, and the companies they let hear them, were theirs alone.
                  endInterview();
                  forgetCloudConsent();
                  setAccount(null);
                })
              }
              onCard={() => setScreen(Screen.card)}
              onTalkCard={talkCard}
              onAccount={setAccount}
              onColleagues={openColleagues}
            />
          )}
          {screen === Screen.card && <MyCard ports={ports} account={account} onSaved={saved} onTalk={talkCard} />}
          {screen === Screen.colleagues && (
            <Colleagues
              account={account}
              device={device}
              run={run}
              syncedAt={view.syncedAt}
              place={colleaguePlace}
              onPlace={setColleaguePlace}
            />
          )}
        </Shell>
      </ColleagueProvider>
    </I18nProvider>
  );
}
