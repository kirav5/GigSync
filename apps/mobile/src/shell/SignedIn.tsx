import type { Agent, GigDevice, NeedTo, Ports } from "@gigsync/core";
import type { City, QrCode, UserId } from "@gigsync/protocol";
import { type RefObject, useCallback, useEffect, useState } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { keepBackInApp } from "../adapters/back.js";
import { useCardRefill } from "../card/refill.js";
import { type ChosenWorker, needToOf } from "../find/ask.js";
import { startFindChat } from "../find/findChats.js";
import { useI18n } from "../i18n.js";
import { useMovePrompt } from "../move/useMovePrompt.js";
import { useOpenedQr } from "../qr/useOpenedQr.js";
import { useReminders } from "../schedule/useReminders.js";
import { LinksProvider } from "../screens/mentor/links.js";
import { HowItWorks } from "../screens/start/HowItWorks.js";
import { Screen } from "../state.js";
import { startChat } from "../talk/talkStore.js";
import type { GigView } from "../useGig.js";
import { ConsentToast } from "./ConsentToast.js";
import { useChatList } from "./chatLists.js";
import { chatOf, isTab, landingOf } from "./nav.js";
import { ScreenView } from "./ScreenView.js";
import { Shell } from "./Shell.js";
import { useAlerts } from "./useAlerts.js";
import { useConsentOnOpen } from "./useConsentOnOpen.js";
import { useHowItWorks } from "./useHowItWorks.js";
import { useNav } from "./useNav.js";
import { useRecordFollow } from "./useRecordFollow.js";
import { useRestoredJobs } from "./useRestoredJobs.js";

interface Props {
  agent: Agent;
  /** The owner's view of this phone. */
  ports: Ports;
  account: Account;
  device: GigDevice;
  view: GigView;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  onAccount: (a: Account) => void;
  onSignOut: () => void;
  /** Where App's one Back listener asks this owner's screens to move back; true when they did. */
  back: RefObject<() => boolean>;
}

/** The open chat's title for the top bar, by its first words; until then "New chat" for a worker, "Find" for a household. */
function useChatTitle(isWorker: boolean): string {
  const { t } = useI18n();
  const { chats, open } = useChatList(isWorker);
  return chats.find((c) => c.id === open)?.title ?? t(isWorker ? "chats.new" : "nav.find");
}

/**
 * One signed-in owner's app: where they are (a stack of screens under four tabs, shell/useNav.ts), what was picked on
 * the way there, Back (one screen at a time, then out of the app), and the frame around it all. Mounted afresh for
 * each owner, so nothing of the last one's screens carries over.
 */
export function SignedIn({ agent, ports, account, device, view, run, onAccount, onSignOut, back }: Props) {
  const landing = landingOf(account);
  const isWorker = account.role === AccountRole.worker;
  const tabFor = useCallback((s: Screen) => isTab(account, s), [account]);
  const nav = useNav(landing, tabFor);
  const { go } = nav;
  /**
   * Talk opens on the card interview: set by every way into it (and from the start for a worker with no card yet),
   * cleared once Talk has opened it, so coming back to Talk from the chats keeps the chat picked there.
   */
  const [interview, setInterview] = useState(() => isWorker && !account.worker);
  /** Whose mentor link is open on its own screen. */
  const [openLink, setOpenLink] = useState<UserId>();
  /** The city of the move Talk is about, for the moving checklist (the landing journey) to start with. */
  const [movingTo, setMovingTo] = useState<City>();
  /** The QR code whose owner the person screen shows. */
  const [personCode, setPersonCode] = useState<QrCode>();
  const chatTitle = useChatTitle(isWorker);
  const { lang } = useI18n();

  const showPerson = useCallback(
    (code: QrCode) => {
      setPersonCode(code);
      go(Screen.person);
    },
    [go],
  );
  // A QR link the phone's camera opened: whoever it finds.
  useOpenedQr(true, showPerson);
  // An owner signed in before the sign-in line agreed by using GigSync: recorded once, said in one line (ADR 0039 §4).
  const consent = useConsentOnOpen(ports, account);
  // A phone with no jobs for this owner refills them from their record on GigSync.
  useRestoredJobs(device, account, () => void run(async () => undefined));
  // A job the other side ended through the record (their phone rebuilt it) moves on here too.
  useRecordFollow(device, account, () => void run(async () => undefined));
  // Notifications: the push address and language told again on each open, and who the jobs are with.
  useAlerts(account.session, lang, view.jobs, view.names);
  // A worker's own bookings about to start, reminded by the phone itself while the app runs (ADR 0048 §7).
  useReminders(ports, lang, isWorker);
  // A new phone (ADR 0037): an owner with nothing here yet and another active phone is asked once whether they are
  // moving from it, and a worker's card comes back from the board.
  // Only from the screen it landed on: a screen the owner moved to meanwhile stays. That is the first landing, as a
  // worker's card coming back from the board meanwhile makes Home their landing while Talk is still open.
  const [firstLanding] = useState(landing);
  useMovePrompt(ports, account.session, () => nav.goFrom(firstLanding, Screen.moveIn));
  useCardRefill(ports, account, onAccount);
  // A worker with no card yet sees what GigSync does once, before the card chat; not over a screen they were sent to.
  const how = useHowItWorks(ports, isWorker && !account.worker);

  useEffect(() => {
    back.current = nav.back;
  });
  useEffect(
    () => () => {
      back.current = () => false;
    },
    [back],
  );
  useEffect(() => keepBackInApp(nav.stack.length > 1), [nav.stack.length]);

  const chat = chatOf(account);
  /** "New chat": the open chat stays in the list and an empty one opens. */
  const newChat = () => {
    if (isWorker) startChat();
    else startFindChat();
    go(chat);
  };
  const moves = {
    go,
    showPerson,
    newChat,
    saved: (a: Account) => {
      onAccount(a);
      setInterview(false);
    },
    talkCard: () => {
      setInterview(true);
      go(Screen.talk);
    },
    interviewOpened: () => setInterview(false),
    openLanding: (city: City) => {
      setMovingTo(city);
      go(Screen.landing);
    },
    showLink: (user: UserId) => {
      setOpenLink(user);
      go(Screen.link);
    },
    /** A worker chosen from their QR or their offer: a new Find chat, addressed to them alone. */
    askFor: (worker: ChosenWorker) => {
      startFindChat(needToOf(worker));
      go(Screen.find);
    },
    /** A job that ended without the work: the same worker asked again, or anyone (ADR 0053 §5). */
    findFor: (to?: NeedTo) => {
      startFindChat(to);
      go(Screen.find);
    },
    signOut: onSignOut,
  };
  const data = {
    agent,
    ports,
    account,
    device,
    view,
    run,
    interview,
    openLink,
    movingTo,
    personCode,
  };
  return (
    <LinksProvider device={device} syncedAt={view.syncedAt}>
      <Shell
        account={account}
        nav={nav}
        tasks={view.tasks.length + view.offers.length}
        chatTitle={chatTitle}
        onNewChat={newChat}
      >
        {how.show !== false && nav.screen === landing ? (
          how.show && (
            <HowItWorks
              onDone={() => {
                how.seen();
                moves.talkCard();
              }}
              onSkip={how.seen}
            />
          )
        ) : (
          <ScreenView screen={nav.screen} d={data} m={moves} />
        )}
        {consent.said && <ConsentToast onDone={consent.dismiss} />}
      </Shell>
    </LinksProvider>
  );
}
