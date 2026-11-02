import type { Agent, GigDevice, Ports } from "@gigsync/core";
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
import { LinksProvider } from "../screens/mentor/links.js";
import { Screen } from "../state.js";
import { startChat } from "../talk/talkStore.js";
import type { GigView } from "../useGig.js";
import { ConsentToast } from "./ConsentToast.js";
import { useChatList } from "./chatLists.js";
import { drawerOpen, setDrawer, useDrawer } from "./drawer.js";
import { backFrom, homeOf } from "./nav.js";
import { ScreenView } from "./ScreenView.js";
import { Shell } from "./Shell.js";
import { useAlerts } from "./useAlerts.js";
import { useConsentOnOpen } from "./useConsentOnOpen.js";
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
 * One signed-in owner's app: which screen is open and what was picked on the way to it, Back (the drawer first, then
 * a screen to the one it was opened from, any other to the chat), and the frame around it all. Mounted afresh for
 * each owner, so nothing of the last one's screens carries over.
 */
export function SignedIn({ agent, ports, account, device, view, run, onAccount, onSignOut, back }: Props) {
  const home = homeOf(account);
  const isWorker = account.role === AccountRole.worker;
  const [screen, setScreen] = useState<Screen>(home);
  /** Talk opens on the card interview: set by every way into it, cleared once the card is published. */
  const [interview, setInterview] = useState(false);
  /** Whose mentor link is open on its own screen. */
  const [openLink, setOpenLink] = useState<UserId>();
  /** The city of the move Talk is about, for the moving checklist (the landing journey) to start with. */
  const [movingTo, setMovingTo] = useState<City>();
  /** The QR code whose owner the person screen shows. */
  const [personCode, setPersonCode] = useState<QrCode>();
  const open = useDrawer();
  const chatTitle = useChatTitle(isWorker);
  const { lang } = useI18n();

  const showPerson = useCallback((code: QrCode) => {
    setPersonCode(code);
    setScreen(Screen.person);
  }, []);
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
  // A new phone (ADR 0037): an owner with nothing here yet and another active phone is asked once whether they are
  // moving from it, and a worker's card comes back from the board.
  // Only from the chat it opened on: a screen the owner moved to meanwhile stays.
  useMovePrompt(ports, account.session, () => setScreen((now) => (now === home ? Screen.moveIn : now)));
  useCardRefill(ports, account, onAccount);

  useEffect(() => {
    back.current = () => {
      if (drawerOpen()) {
        setDrawer(false);
        return true;
      }
      const to = backFrom(screen, home);
      if (!to) return false;
      setScreen(to);
      return true;
    };
  });
  useEffect(
    () => () => {
      back.current = () => false;
    },
    [back],
  );
  useEffect(() => keepBackInApp(screen !== home || open), [screen, home, open]);

  const go = (s: Screen) => setScreen(s);
  const moves = {
    go,
    showPerson,
    saved: (a: Account) => {
      onAccount(a);
      setInterview(false);
    },
    talkCard: () => {
      setInterview(true);
      setScreen(Screen.talk);
    },
    openLanding: (city: City) => {
      setMovingTo(city);
      setScreen(Screen.landing);
    },
    showLink: (user: UserId) => {
      setOpenLink(user);
      setScreen(Screen.link);
    },
    /** A worker chosen from their QR or their offer: a new Find chat, addressed to them alone. */
    askFor: (worker: ChosenWorker) => {
      startFindChat(needToOf(worker));
      setScreen(Screen.find);
    },
    signOut: onSignOut,
  };
  /** "New chat": the open chat stays in the list and an empty one opens. */
  const newChat = () => {
    if (isWorker) startChat();
    else startFindChat();
    go(home);
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
        home={home}
        screen={screen}
        onScreen={go}
        onNewChat={newChat}
        onSignOut={onSignOut}
        onBack={() => back.current()}
        tasks={view.tasks.length + view.offers.length}
        chatTitle={chatTitle}
      >
        <ScreenView screen={screen} d={data} m={moves} />
        {consent.said && <ConsentToast onDone={consent.dismiss} />}
      </Shell>
    </LinksProvider>
  );
}
