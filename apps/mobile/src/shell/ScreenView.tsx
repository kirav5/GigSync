import type { Agent, GigDevice, NeedTo, Ports } from "@gigsync/core";
import type { City, QrCode, UserId } from "@gigsync/protocol";
import { type Account, AccountRole } from "../adapters/account.js";
import type { OpenInterview } from "../card/openInterview.js";
import type { ChosenWorker } from "../find/ask.js";
import { Alerts } from "../screens/alerts/Alerts.js";
import { HelpUnion } from "../screens/help/HelpUnion.js";
import { Landing } from "../screens/Landing.js";
import { MyCard } from "../screens/MyCard.js";
import { AddressesPage } from "../screens/me/AddressesPage.js";
import { People } from "../screens/me/People.js";
import { WorkAreaPage } from "../screens/me/WorkAreaPage.js";
import { FindMentor } from "../screens/mentor/FindMentor.js";
import { LinkScreen } from "../screens/mentor/LinkScreen.js";
import { MoveIn } from "../screens/move/MoveIn.js";
import { MoveOut } from "../screens/move/MoveOut.js";
import { AboutMe } from "../screens/pages/AboutMe.js";
import { InstallPage } from "../screens/pages/InstallPage.js";
import { LanguagePage } from "../screens/pages/LanguagePage.js";
import { MyCardPage } from "../screens/pages/MyCardPage.js";
import { Privacy } from "../screens/pages/Privacy.js";
import { SettingsPage } from "../screens/pages/SettingsPage.js";
import { TermsPage } from "../screens/pages/TermsPage.js";
import { Person } from "../screens/qr/Person.js";
import { MyRecord } from "../screens/record/MyRecord.js";
import { GetVerified } from "../screens/verify/GetVerified.js";
import { Screen } from "../state.js";
import type { GigView } from "../useGig.js";
import { ChatsScreen } from "./ChatsScreen.js";
import { chatOf, landingOf } from "./nav.js";
import { FindTab, JobsTab, MoneyTab, TalkScreen } from "./TabScreens.js";

/** What the open screen is about: the owner, this phone, and what was picked on the way to it. */
export interface ScreenData {
  agent: Agent;
  ports: Ports;
  account: Account;
  device: GigDevice;
  view: GigView;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Whether Talk opens on the card interview. */
  interview: OpenInterview;
  openLink: UserId | undefined;
  movingTo: City | undefined;
  personCode: QrCode | undefined;
}

/** Where a screen's buttons lead. */
export interface ScreenMoves {
  /** Opens a screen: a tab starts again from it, any other goes on top of the open one (shell/useNav.ts). */
  go: (s: Screen) => void;
  saved: (a: Account) => void;
  talkCard: () => void;
  /** Talk opened the card interview, so it does not open it again. */
  interviewOpened: () => void;
  openLanding: (city: City) => void;
  showLink: (user: UserId) => void;
  showPerson: (code: QrCode) => void;
  askFor: (worker: ChosenWorker) => void;
  /** A new Find chat, addressed to one worker or open to anyone. */
  findFor: (to?: NeedTo) => void;
  /** A new chat for the owner, Talk's or Find's, opened. */
  newChat: () => void;
  /** Signs this owner out of this phone. */
  signOut: () => void;
}

/** The screens the profile sheet opens: the owner's card, pages and settings, and the screens opened from those. */
function MeScreen({ screen, d, m }: { screen: Screen; d: ScreenData; m: ScreenMoves }) {
  const { ports, account, device, view, run } = d;
  const isWorker = account.role === AccountRole.worker;
  switch (screen) {
    case Screen.card:
      return (
        <MyCardPage
          ports={ports}
          account={account}
          syncedAt={view.syncedAt}
          onTalk={m.talkCard}
          onCardForm={() => m.go(Screen.cardEdit)}
          onScanned={m.showPerson}
          onSaved={m.saved}
        />
      );
    case Screen.cardEdit:
      return <MyCard ports={ports} account={account} onSaved={m.saved} onTalk={m.talkCard} />;
    case Screen.myRecord:
      return <MyRecord ports={ports} account={account} view={view} onCard={() => m.go(Screen.card)} />;
    case Screen.about:
      return (
        <AboutMe
          ports={ports}
          account={account}
          isWorker={isWorker}
          onEditCard={() => m.go(Screen.cardEdit)}
          onEditArea={() => m.go(Screen.workArea)}
          onTalk={m.talkCard}
        />
      );
    case Screen.privacy:
      return <Privacy ports={ports} account={account} view={view} isWorker={isWorker} />;
    case Screen.settings:
      return (
        <SettingsPage
          ports={ports}
          account={account}
          isWorker={isWorker}
          onSaved={m.saved}
          onInstall={() => m.go(Screen.install)}
          onMoveOut={() => m.go(Screen.moveOut)}
          onMoveIn={() => m.go(Screen.moveIn)}
          onTerms={() => m.go(Screen.terms)}
          onSignOut={m.signOut}
        />
      );
    case Screen.help:
      return (
        <HelpUnion
          ports={ports}
          session={account.session}
          onFindMentor={() => m.go(Screen.findMentor)}
          onOpenLink={m.showLink}
          onJobs={() => m.go(Screen.activity)}
          onMoving={() => m.go(Screen.landing)}
          onTerms={() => m.go(Screen.terms)}
        />
      );
    case Screen.people:
      return (
        <People ports={ports} account={account} device={device} run={run} syncedAt={view.syncedAt} onAsk={m.findFor} />
      );
    case Screen.language:
      return <LanguagePage />;
    case Screen.verify:
      return <GetVerified ports={ports} account={account} onAccount={m.saved} />;
    case Screen.addresses:
      return <AddressesPage ports={ports} session={account.session} />;
    case Screen.workArea:
      return <WorkAreaPage ports={ports} account={account} onSaved={m.saved} onCard={() => m.go(Screen.card)} />;
    case Screen.terms:
      return <TermsPage />;
    case Screen.moveOut:
      return <MoveOut ports={ports} account={account} sync={() => run(async () => undefined)} onSignOut={m.signOut} />;
    case Screen.moveIn:
      return <MoveIn ports={ports} account={account} onAccount={m.saved} onDone={() => m.go(landingOf(account))} />;
    case Screen.install:
      return <InstallPage />;
    case Screen.link:
      return (
        <LinkScreen
          device={device}
          run={run}
          syncedAt={view.syncedAt}
          user={d.openLink}
          onGone={() => m.go(Screen.help)}
        />
      );
    default:
      return null;
  }
}

/** The open screen: a tab's, one opened from inside another, or a chat. */
export function ScreenView({ screen, d, m }: { screen: Screen; d: ScreenData; m: ScreenMoves }) {
  const { ports, account, device, view, run } = d;
  switch (screen) {
    case Screen.find:
      return <FindTab d={d} m={m} />;
    case Screen.talk:
      return <TalkScreen d={d} m={m} />;
    case Screen.activity:
      return <JobsTab d={d} m={m} />;
    case Screen.records:
      return <MoneyTab d={d} m={m} />;
    case Screen.chats:
      return (
        <ChatsScreen
          isWorker={account.role === AccountRole.worker}
          onOpened={() => m.go(chatOf(account))}
          onNewChat={m.newChat}
        />
      );
    case Screen.alerts:
      return <Alerts view={view} device={device} onJobs={() => m.go(Screen.activity)} />;
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
      return <MeScreen screen={screen} d={d} m={m} />;
  }
}
