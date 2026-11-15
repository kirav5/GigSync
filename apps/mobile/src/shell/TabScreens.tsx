import { AccountRole } from "../adapters/account.js";
import { AgentScreen } from "../screens/Agent.js";
import { FindChat } from "../screens/find/FindChat.js";
import { Requests } from "../screens/Requests.js";
import { HouseholdRecords } from "../screens/record/HouseholdRecords.js";
import { WorkerRecords } from "../screens/record/WorkerRecords.js";
import { Today } from "../screens/Today.js";
import { Screen } from "../state.js";
import type { ScreenData, ScreenMoves } from "./ScreenView.js";

/** What a tab's screen is given: what it is about, and where its buttons lead. */
interface TabProps {
  d: ScreenData;
  m: ScreenMoves;
}

/** A household's Home tab: Find's chat (or form); a need sent opens Jobs, My places the saved places. */
export function FindTab({ d, m }: TabProps) {
  return (
    <FindChat
      ports={d.ports}
      account={d.account}
      device={d.device}
      onAsked={() => m.go(Screen.activity)}
      onPlaces={() => m.go(Screen.addresses)}
    />
  );
}

/** A worker's Home tab: Talk, their chat with their agent; its greeting opens Jobs and Get verified. */
export function TalkScreen({ d, m }: TabProps) {
  return (
    <AgentScreen
      agent={d.agent}
      ports={d.ports}
      account={d.account}
      interview={d.interview}
      onInterviewOpened={m.interviewOpened}
      onSaved={m.saved}
      onChecklist={m.openLanding}
      onFindMentor={() => m.go(Screen.findMentor)}
      onJobs={() => m.go(Screen.activity)}
      onVerify={() => m.go(Screen.verify)}
      view={d.view}
      device={d.device}
      run={d.run}
    />
  );
}

/** The Jobs tab, the same frame for both: a worker's with their card nudges, a household's with offers to work. */
export function JobsTab({ d, m }: TabProps) {
  const { account, view, device, run } = d;
  if (account.role === AccountRole.consumer)
    return <Requests view={view} device={device} run={run} onAsk={m.askFor} onRecords={() => m.go(Screen.records)} />;
  return (
    <Today
      ports={d.ports}
      view={view}
      device={device}
      run={run}
      account={account}
      onAddPayee={() => m.go(Screen.about)}
      onRecords={() => m.go(Screen.records)}
      onMakeCard={m.talkCard}
      onOpenCard={() => m.go(Screen.card)}
      onSaved={m.saved}
    />
  );
}

/** The Money tab, for both: a worker's earnings and work record; what a household paid. */
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
