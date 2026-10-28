import { Agent } from "@gigsync/core";
import type { Engagement } from "@gigsync/protocol";
import { useEffect, useMemo, useState } from "react";
import { type Account, AccountRole, deviceFor, loadAccount, signOut } from "./adapters/account.js";
import { apiReachable } from "./adapters/api.js";
import { chosenModel } from "./adapters/model.js";
import { createPorts } from "./adapters/ports.js";
import { JobStep, jobStep } from "./payments/store.js";
import { CONSUMER_NAV, Shell, WORKER_NAV } from "./Shell.js";
import { AgentScreen } from "./screens/Agent.js";
import { Find } from "./screens/Find.js";
import { Jobs } from "./screens/Jobs.js";
import { MyCard } from "./screens/MyCard.js";
import { Pay } from "./screens/Pay.js";
import { Record } from "./screens/Record.js";
import { Requests } from "./screens/Requests.js";
import { Settings } from "./screens/Settings.js";
import { SignIn } from "./screens/SignIn.js";
import { Today } from "./screens/Today.js";
import { Screen, useGigData } from "./state.js";
import { useGig } from "./useGig.js";

/** Where each role lands after signing in. */
const HOME: Readonly<Record<AccountRole, Screen>> = {
  [AccountRole.consumer]: Screen.find,
  [AccountRole.worker]: Screen.card,
};

/** GigSync on one phone: sign in, then a consumer finds and asks, a worker is found and answers; agents negotiate. */
export function App() {
  const ports = useMemo(createPorts, []);
  const agent = useMemo(() => new Agent(ports), [ports]);
  const gig = useGigData(ports);
  const [account, setAccount] = useState<Account | null>();
  const device = useMemo(() => (account ? deviceFor(ports, account) : undefined), [ports, account]);
  const { view, run } = useGig(ports, device);
  const [screen, setScreen] = useState<Screen>(Screen.find);
  const [navOpen, setNavOpen] = useState(false);
  const [payJob, setPayJob] = useState<string>();
  const [platform, setPlatform] = useState("web");
  const [online, setOnline] = useState<boolean>();

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setPlatform(Capacitor.getPlatform()));
    void apiReachable().then(setOnline);
    void loadAccount(ports).then((a) => {
      setAccount(a ?? null);
      if (a) setScreen(a.role === AccountRole.worker && a.worker ? Screen.requests : HOME[a.role]);
    });
  }, [ports]);

  useEffect(() => {
    void chosenModel.load(ports.storage);
  }, [ports]);

  if (account === undefined) return null;
  if (account === null || !device) {
    return (
      <div className="app">
        <main className="main">
          <div className="content">
            <div className="inner">
              <SignIn
                ports={ports}
                onSignedIn={(a) => {
                  setAccount(a);
                  setScreen(HOME[a.role]);
                }}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isWorker = account.role === AccountRole.worker;
  const pay = (job: Engagement) => {
    setPayJob(job.id);
    setScreen(Screen.pay);
  };
  const due = gig.jobs.filter((j) => jobStep(j, gig.payments) === JobStep.done).length;
  const waiting = view.tasks.length;
  const status = `${platform} · ${online === undefined ? "…" : online ? "online" : "offline"}`;

  return (
    <Shell
      nav={isWorker ? WORKER_NAV : CONSUMER_NAV}
      who={`${account.contact.name} · ${isWorker ? "worker" : "customer"}`}
      onSignOut={() => void signOut(ports).then(() => setAccount(null))}
      screen={screen}
      onScreen={setScreen}
      navOpen={navOpen}
      onNav={setNavOpen}
      trail={{
        [Screen.requests]: waiting ? `${waiting} to decide` : view.jobs.length ? String(view.jobs.length) : "",
        [Screen.jobs]: gig.jobs.length ? String(gig.jobs.length) : "",
        [Screen.pay]: due ? `${due} due` : "",
      }}
      status={status}
    >
      {screen === Screen.find && (
        <Find ports={ports} account={account} device={device} onAsked={() => setScreen(Screen.requests)} />
      )}
      {screen === Screen.requests && <Requests isWorker={isWorker} view={view} device={device} run={run} />}
      {screen === Screen.card && <MyCard ports={ports} account={account} onSaved={setAccount} />}
      {screen === Screen.today && <Today data={gig} go={setScreen} pay={pay} />}
      {screen === Screen.jobs && <Jobs ports={ports} data={gig} changed={gig.reload} pay={pay} />}
      {screen === Screen.pay && (
        <Pay data={gig} book={gig.book} jobId={payJob} onJob={setPayJob} go={setScreen} changed={gig.reload} />
      )}
      {screen === Screen.record && <Record data={gig} />}
      {screen === Screen.agent && <AgentScreen agent={agent} />}
      {screen === Screen.settings && <Settings ports={ports} data={gig} changed={gig.reload} />}
    </Shell>
  );
}
