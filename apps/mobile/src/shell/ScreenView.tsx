import type { Agent, GigDevice, Ports } from "@gigsync/core";
import type { City, QrCode, UserId } from "@gigsync/protocol";
import { type Account, AccountRole } from "../adapters/account.js";
import type { ChosenWorker } from "../find/ask.js";
import { AgentScreen } from "../screens/Agent.js";
import { Find } from "../screens/Find.js";
import { Landing } from "../screens/Landing.js";
import { MyCard } from "../screens/MyCard.js";
import { FindMentor } from "../screens/mentor/FindMentor.js";
import { LinkScreen } from "../screens/mentor/LinkScreen.js";
import { Passbook } from "../screens/Passbook.js";
import { AboutMe } from "../screens/pages/AboutMe.js";
import { HouseholdReceipts } from "../screens/pages/HouseholdReceipts.js";
import { InstallPage } from "../screens/pages/InstallPage.js";
import { MyCardPage } from "../screens/pages/MyCardPage.js";
import { Privacy } from "../screens/pages/Privacy.js";
import { SettingsPage } from "../screens/pages/SettingsPage.js";
import { Person } from "../screens/qr/Person.js";
import { Requests } from "../screens/Requests.js";
import { Today } from "../screens/Today.js";
import { CardState, Screen } from "../state.js";
import type { GigView } from "../useGig.js";

/** What the open screen is about: the owner, this phone, and what was picked on the way to it. */
export interface ScreenData {
  agent: Agent;
  ports: Ports;
  account: Account;
  device: GigDevice;
  view: GigView;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Talk opens on the card interview. */
  interview: boolean;
  openLink: UserId | undefined;
  movingTo: City | undefined;
  personCode: QrCode | undefined;
}

/** Where a screen's buttons lead. */
export interface ScreenMoves {
  go: (s: Screen) => void;
  saved: (a: Account) => void;
  talkCard: () => void;
  openLanding: (city: City) => void;
  showLink: (user: UserId) => void;
  showPerson: (code: QrCode) => void;
  askFor: (worker: ChosenWorker) => void;
}

function cardState(account: Account): CardState {
  if (!account.worker) return CardState.none;
  return account.listed === false ? CardState.off : CardState.on;
}

/** The chat for each owner: Talk for a worker, Find's chat for a household. */
function Home({ d, m }: { d: ScreenData; m: ScreenMoves }) {
  if (d.account.role === AccountRole.consumer)
    return <Find ports={d.ports} account={d.account} device={d.device} onAsked={() => m.go(Screen.activity)} />;
  return (
    <AgentScreen
      agent={d.agent}
      ports={d.ports}
      account={d.account}
      interview={d.interview}
      onSaved={m.saved}
      onChecklist={m.openLanding}
      onFindMentor={() => m.go(Screen.findMentor)}
      view={d.view}
      device={d.device}
      run={d.run}
    />
  );
}

/** Today for a worker, My jobs for a household. */
function Activity({ d, m }: { d: ScreenData; m: ScreenMoves }) {
  const { account, view, device, run } = d;
  if (account.role === AccountRole.consumer) return <Requests view={view} device={device} run={run} onAsk={m.askFor} />;
  return (
    <Today
      ports={d.ports}
      view={view}
      device={device}
      run={run}
      card={cardState(account)}
      onMakeCard={m.talkCard}
      onOpenCard={() => m.go(Screen.card)}
      onAddPayee={() => m.go(Screen.about)}
      account={account}
    />
  );
}

/** The Passbook and work record for a worker; what was paid for a household. */
function Receipts({ d, m }: { d: ScreenData; m: ScreenMoves }) {
  const { account, view, device, run } = d;
  const me = account.session.user;
  if (account.role === AccountRole.consumer) return <HouseholdReceipts view={view} me={me} device={device} run={run} />;
  return <Passbook view={view} me={me} device={device} run={run} onAddPayee={() => m.go(Screen.about)} />;
}

/** The open screen, from the menu or opened from inside another. */
export function ScreenView({ screen, d, m }: { screen: Screen; d: ScreenData; m: ScreenMoves }) {
  const { ports, account, device, view, run } = d;
  const isWorker = account.role === AccountRole.worker;
  switch (screen) {
    case Screen.activity:
      return <Activity d={d} m={m} />;
    case Screen.receipts:
      return <Receipts d={d} m={m} />;
    case Screen.card:
      return (
        <MyCardPage
          ports={ports}
          account={account}
          jobs={view.jobs}
          onCardForm={() => m.go(Screen.cardEdit)}
          onScanned={m.showPerson}
        />
      );
    case Screen.cardEdit:
      return <MyCard ports={ports} account={account} onSaved={m.saved} onTalk={m.talkCard} />;
    case Screen.about:
      return <AboutMe ports={ports} account={account} isWorker={isWorker} />;
    case Screen.privacy:
      return <Privacy ports={ports} device={device} isWorker={isWorker} onOpenLink={m.showLink} />;
    case Screen.settings:
      return <SettingsPage ports={ports} isWorker={isWorker} onInstall={() => m.go(Screen.install)} />;
    case Screen.install:
      return <InstallPage />;
    case Screen.link:
      return (
        <LinkScreen
          device={device}
          run={run}
          syncedAt={view.syncedAt}
          user={d.openLink}
          onGone={() => m.go(Screen.privacy)}
        />
      );
    case Screen.landing:
      return (
        <Landing
          ports={ports}
          account={account}
          jobs={view.jobs}
          city={d.movingTo}
          onFindMentor={() => m.go(Screen.findMentor)}
        />
      );
    case Screen.findMentor:
      return <FindMentor ports={ports} account={account} device={device} run={run} syncedAt={view.syncedAt} />;
    case Screen.person:
      return d.personCode ? (
        <Person account={account} device={device} run={run} code={d.personCode} onAsk={m.askFor} />
      ) : null;
    default:
      return <Home d={d} m={m} />;
  }
}
