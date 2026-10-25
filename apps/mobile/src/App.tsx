import { Agent } from "@gigsync/core";
import type { Engagement } from "@gigsync/protocol";
import { useEffect, useMemo, useState } from "react";
import { apiReachable } from "./adapters/api.js";
import { chosenModel } from "./adapters/model.js";
import { createPorts } from "./adapters/ports.js";
import { JobStep, jobStep } from "./payments/store.js";
import { Shell } from "./Shell.js";
import { AgentScreen } from "./screens/Agent.js";
import { Jobs } from "./screens/Jobs.js";
import { Pay } from "./screens/Pay.js";
import { Record } from "./screens/Record.js";
import { Settings } from "./screens/Settings.js";
import { Today } from "./screens/Today.js";
import { Screen, useGigData } from "./state.js";

/** GigSync for the worker: Collab's layout and look, their jobs, their payments, their record. */
export function App() {
  const ports = useMemo(createPorts, []);
  const agent = useMemo(() => new Agent(ports), [ports]);
  const gig = useGigData(ports);
  const [screen, setScreen] = useState<Screen>(Screen.today);
  const [navOpen, setNavOpen] = useState(false);
  const [payJob, setPayJob] = useState<string>();
  const [platform, setPlatform] = useState("web");
  const [online, setOnline] = useState<boolean>();

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setPlatform(Capacitor.getPlatform()));
    void apiReachable().then(setOnline);
  }, []);

  useEffect(() => {
    void chosenModel.load(ports.storage);
  }, [ports]);

  const pay = (job: Engagement) => {
    setPayJob(job.id);
    setScreen(Screen.pay);
  };
  const due = gig.jobs.filter((j) => jobStep(j, gig.payments) === JobStep.done).length;
  const status = `${platform} · ${online === undefined ? "…" : online ? "online" : "offline"}`;

  return (
    <Shell
      screen={screen}
      onScreen={setScreen}
      navOpen={navOpen}
      onNav={setNavOpen}
      trail={{ [Screen.jobs]: gig.jobs.length ? String(gig.jobs.length) : "", [Screen.pay]: due ? `${due} due` : "" }}
      status={status}
    >
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
