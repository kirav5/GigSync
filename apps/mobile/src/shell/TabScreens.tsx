import { type Account, AccountRole } from "../adapters/account.js";
import { AgentScreen } from "../screens/Agent.js";
import { Find } from "../screens/Find.js";
import { WorkerHome } from "../screens/home/WorkerHome.js";
import { HouseholdMe } from "../screens/me/HouseholdMe.js";
import { WorkerMe } from "../screens/me/WorkerMe.js";
import { Requests } from "../screens/Requests.js";
import { HouseholdRecords } from "../screens/record/HouseholdRecords.js";
import { WorkerRecords } from "../screens/record/WorkerRecords.js";
import { Today } from "../screens/Today.js";
import { CardState, Screen } from "../state.js";
import { BellButton, ChatsButton } from "./BarButtons.js";
import type { ScreenData, ScreenMoves } from "./ScreenView.js";

/** What a tab's screen is given: what it is about, and where its buttons lead. */
interface TabProps {
  d: ScreenData;
  m: ScreenMoves;
}

function cardState(account: Account): CardState {
  if (!account.worker) return CardState.none;
  return account.listed === false ? CardState.off : CardState.on;
}

/** What a worker's Home shows: their nudges, money and today, with their card's state. */
function homeProps({ d, m }: TabProps) {
  const { account, view, device, run, ports } = d;
  return {
    ports,
    view,
    device,
    run,
    account,
    card: cardState(account),
    onMakeCard: m.talkCard,
    onOpenCard: () => m.go(Screen.card),
    onAddPayee: () => m.go(Screen.about),
    onSaved: m.saved,
  };
}

/** A worker's Home tab, with the bell. */
export function HomeTab({ d, m }: TabProps) {
  return (
    <>
      <BellButton onOpen={() => m.go(Screen.alerts)} />
      <WorkerHome
        {...homeProps({ d, m })}
        onTalk={() => m.go(Screen.talk)}
        onJobs={() => m.go(Screen.activity)}
        onMoney={() => m.go(Screen.records)}
      />
    </>
  );
}

/** A household's Find tab: its chat (or form), with the bell and the chats; a need sent opens Jobs. */
export function FindTab({ d, m }: TabProps) {
  return (
    <>
      <BellButton onOpen={() => m.go(Screen.alerts)} />
      <ChatsButton onOpen={() => m.go(Screen.chats)} />
      <Find ports={d.ports} account={d.account} device={d.device} onAsked={() => m.go(Screen.activity)} />
    </>
  );
}

/** Talk, a worker's chat with their agent, with the chats at the top bar's end. */
export function TalkScreen({ d, m }: TabProps) {
  return (
    <>
      <ChatsButton onOpen={() => m.go(Screen.chats)} />
      <AgentScreen
        agent={d.agent}
        ports={d.ports}
        account={d.account}
        interview={d.interview}
        onInterviewOpened={m.interviewOpened}
        onSaved={m.saved}
        onChecklist={m.openLanding}
        onFindMentor={() => m.go(Screen.findMentor)}
        view={d.view}
        device={d.device}
        run={d.run}
      />
    </>
  );
}

/** The Jobs tab, the same frame for both: a worker's with their card nudges, a household's with offers to work. */
export function JobsTab({ d, m }: TabProps) {
  const { account, view, device, run } = d;
  const bell = <BellButton onOpen={() => m.go(Screen.alerts)} />;
  if (account.role === AccountRole.consumer)
    return (
      <>
        {bell}
        <Requests view={view} device={device} run={run} onAsk={m.askFor} onRecords={() => m.go(Screen.records)} />
      </>
    );
  return (
    <>
      {bell}
      <Today
        ports={d.ports}
        view={view}
        device={device}
        run={run}
        onAddPayee={() => m.go(Screen.about)}
        onRecords={() => m.go(Screen.records)}
        rules={account.worker}
      />
    </>
  );
}

/** The Money tab (Pay for a household): a worker's earnings and work record; what a household paid. */
export function MoneyTab({ d, m }: TabProps) {
  const { account, view, device, run } = d;
  if (account.role === AccountRole.consumer)
    return <HouseholdRecords account={account} view={view} device={device} run={run} onAgain={m.findFor} />;
  return (
    <WorkerRecords
      ports={d.ports}
      account={account}
      view={view}
      device={device}
      run={run}
      onAddPayee={() => m.go(Screen.about)}
    />
  );
}

/** The Me tab: who the owner is, and everything about them in one list. */
export function MeTab({ d, m }: TabProps) {
  if (d.account.role === AccountRole.consumer) return <HouseholdMe ports={d.ports} account={d.account} onOpen={m.go} />;
  return <WorkerMe account={d.account} onOpen={m.go} />;
}
