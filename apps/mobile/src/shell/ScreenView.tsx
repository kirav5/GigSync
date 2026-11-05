import type { Agent, GigDevice, NeedTo, Ports } from "@gigsync/core";
import type { City, QrCode, UserId } from "@gigsync/protocol";
import { type Account, AccountRole } from "../adapters/account.js";
import type { ChosenWorker } from "../find/ask.js";
import { AgentScreen } from "../screens/Agent.js";
import { Find } from "../screens/Find.js";
import { Landing } from "../screens/Landing.js";
import { MyCard } from "../screens/MyCard.js";
import { FindMentor } from "../screens/mentor/FindMentor.js";
import { LinkScreen } from "../screens/mentor/LinkScreen.js";
import { MoveIn } from "../screens/move/MoveIn.js";
import { MoveOut } from "../screens/move/MoveOut.js";
import { AboutMe } from "../screens/pages/AboutMe.js";
import { InstallPage } from "../screens/pages/InstallPage.js";
import { MyCardPage } from "../screens/pages/MyCardPage.js";
import { Privacy } from "../screens/pages/Privacy.js";
import { SettingsPage } from "../screens/pages/SettingsPage.js";
import { TermsPage } from "../screens/pages/TermsPage.js";
import { Person } from "../screens/qr/Person.js";
import { Requests } from "../screens/Requests.js";
import { HouseholdRecords } from "../screens/record/HouseholdRecords.js";
import { WorkerRecords } from "../screens/record/WorkerRecords.js";
import { Today } from "../screens/Today.js";
import { CardState, Screen } from "../state.js";
import type { GigView } from "../useGig.js";
import { homeOf } from "./nav.js";

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
  /** A new Find chat, addressed to one worker or open to anyone. */
  findFor: (to?: NeedTo) => void;
  /** Signs this owner out of this phone. */
  signOut: () => void;
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

/** Activity, the same frame for both: a worker's with their card nudges, a household's with offers to work. */
function Activity({ d, m }: { d: ScreenData; m: ScreenMoves }) {
  const { account, view, device, run } = d;
  const onRecords = () => m.go(Screen.records);
  if (account.role === AccountRole.consumer)
    return <Requests view={view} device={device} run={run} onAsk={m.askFor} onRecords={onRecords} />;
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
      onRecords={onRecords}
      account={account}
      onSaved={m.saved}
    />
  );
}

/** Completed work: a worker's earnings and work record; what a household paid. */
function Records({ d, m }: { d: ScreenData; m: ScreenMoves }) {
  const { account, view, device, run } = d;
  if (account.role === AccountRole.consumer)
    return <HouseholdRecords view={view} me={account.session.user} device={device} run={run} onAgain={m.findFor} />;
  return (
    <WorkerRecords account={account} view={view} device={device} run={run} onAddPayee={() => m.go(Screen.about)} />
  );
}

/** The open screen, from the menu or opened from inside another. */
export function ScreenView({ screen, d, m }: { screen: Screen; d: ScreenData; m: ScreenMoves }) {
  const { ports, account, device, view, run } = d;
  const isWorker = account.role === AccountRole.worker;
  switch (screen) {
    case Screen.activity:
      return <Activity d={d} m={m} />;
    case Screen.records:
      return <Records d={d} m={m} />;
    case Screen.card:
      return (
        <MyCardPage
          ports={ports}
          account={account}
          syncedAt={view.syncedAt}
          onTalk={m.talkCard}
          onCardForm={() => m.go(Screen.cardEdit)}
          onScanned={m.showPerson}
        />
      );
    case Screen.cardEdit:
      return <MyCard ports={ports} account={account} onSaved={m.saved} onTalk={m.talkCard} />;
    case Screen.about:
      return <AboutMe ports={ports} account={account} isWorker={isWorker} />;
    case Screen.privacy:
      return <Privacy ports={ports} account={account} device={device} isWorker={isWorker} onOpenLink={m.showLink} />;
    case Screen.settings:
      return (
        <SettingsPage
          ports={ports}
          session={account.session}
          isWorker={isWorker}
          onInstall={() => m.go(Screen.install)}
          onMoveOut={() => m.go(Screen.moveOut)}
          onMoveIn={() => m.go(Screen.moveIn)}
          onTerms={() => m.go(Screen.terms)}
        />
      );
    case Screen.terms:
      return <TermsPage />;
    case Screen.moveOut:
      return <MoveOut ports={ports} account={account} sync={() => run(async () => undefined)} onSignOut={m.signOut} />;
    case Screen.moveIn:
      return <MoveIn ports={ports} account={account} onAccount={m.saved} onDone={() => m.go(homeOf(account))} />;
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
