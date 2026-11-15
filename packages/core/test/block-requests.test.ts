import type { UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { settle } from "../src/index.js";
import { FakeMentorServer } from "./mentor-phones.js";
import { electrician, fanNeed, MemoryRelay, type Phone, phone, RAVI, RAVI_HOME } from "./phones.js";

/** Ravi, an electrician, and a household that asks him for work; both phones talk to one fake mentor server. */
async function pair() {
  const relay = new MemoryRelay();
  const server = new FakeMentorServer();
  const ravi = await phone(relay, RAVI, { worker: electrician(), mentorApi: server.for(() => ravi.user) });
  const home = await phone(relay, RAVI_HOME, { mentorApi: server.for(() => home.user) });
  return { server, ravi, home, all: () => settle([ravi.device, home.device]) };
}

const jobsFrom = async (p: Phone, user: UserId) =>
  (await p.device.jobs()).filter((j) => j.engagement.counterpart === user);

describe("blocking someone stops their requests; unblocking lets them in again", () => {
  it("drops a new request from a household the worker blocked, and takes the next one after unblock", async () => {
    const { server, ravi, home, all } = await pair();
    await ravi.device.mentors.block(home.user);
    expect(server.blocks).toEqual([{ by: ravi.user, user: home.user }]);
    await home.device.request(fanNeed(65000), [ravi.user]);
    await all();
    expect(await jobsFrom(ravi, home.user)).toEqual([]);

    await ravi.device.mentors.unblock(home.user);
    expect(server.blocks).toEqual([]);
    expect(await ravi.device.mentors.blocked()).toEqual([]);
    await home.device.request(fanNeed(65000), [ravi.user]);
    await all();
    expect(await jobsFrom(ravi, home.user)).toHaveLength(1);
  });
});
