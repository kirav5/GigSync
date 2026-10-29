import { LINK_CODE_TTL_MS, type UserId } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ColleagueError, ColleagueRefusal, settle } from "../src/index.js";
import {
  ASHA_CARD,
  ColleagueRelay,
  colleagueOf,
  linked,
  RAVI_CARD,
  SURESH_CARD,
  stranger,
} from "./colleague-phones.js";
import { ASHA, cook, electrician, type Phone, phone, RAVI } from "./phones.js";

async function pair() {
  const relay = new ColleagueRelay();
  const asha = await phone(relay, ASHA, { worker: cook(), lang: "kn" });
  const ravi = await phone(relay, RAVI, { worker: electrician(), lang: "hi" });
  return { relay, asha, ravi, both: [asha.device, ravi.device] };
}

const refusal = (reason: ColleagueRefusal) => expect.objectContaining({ reason }) as ColleagueError;
const fromTo = (relay: ColleagueRelay, from: Phone, to: UserId) =>
  relay.stored.filter((e) => e.from.user === from.user && e.to.user === to);

afterEach(() => {
  vi.useRealTimers();
});

describe("colleague links", () => {
  it("links two workers who scanned a code, each with the other's card, on one channel", async () => {
    const { asha, ravi } = await pair();
    const code = await asha.device.colleagues.invite(ASHA_CARD);
    expect(code).toContain(asha.user);
    const asked = await ravi.device.colleagues.link(code, RAVI_CARD);
    expect(asked).toMatchObject({ user: asha.user, state: "asked", card: { name: "Asha" }, unread: 0 });

    await settle([ravi.device, asha.device]);
    const onRavi = await colleagueOf(ravi, asha.user);
    const onAsha = await colleagueOf(asha, ravi.user);
    expect(onRavi).toMatchObject({ state: "linked", card: ASHA_CARD });
    expect(onAsha).toMatchObject({ state: "linked", card: RAVI_CARD });
    expect(onRavi?.channel).toBe(onAsha?.channel);
    expect(onRavi?.linked_at).toBeDefined();
    expect(onAsha).not.toHaveProperty("asking");
  });

  it("refuses its own code and anything that is not a colleague code", async () => {
    const { asha } = await pair();
    const own = await asha.device.colleagues.invite(ASHA_CARD);
    await expect(asha.device.colleagues.link(own, ASHA_CARD)).rejects.toEqual(refusal(ColleagueRefusal.ownCode));
    for (const bad of ["hello", "gigsync:colleague?u=usr_x&c=short&n=Asha", own.replace("c=", "x=")])
      await expect(asha.device.colleagues.link(bad, ASHA_CARD)).rejects.toEqual(refusal(ColleagueRefusal.badCode));
    expect(await asha.device.colleagues.list()).toEqual([]);
  });

  it("an expired code links nobody and gets no answer", async () => {
    const { relay, asha, ravi } = await pair();
    vi.useFakeTimers({ toFake: ["Date"] });
    const code = await asha.device.colleagues.invite(ASHA_CARD);
    await ravi.device.colleagues.link(code, RAVI_CARD);
    vi.setSystemTime(Date.now() + LINK_CODE_TTL_MS + 1);
    await settle([ravi.device, asha.device]);
    expect(await asha.device.colleagues.list()).toEqual([]);
    expect((await colleagueOf(ravi, asha.user))?.state).toBe("asked");
    expect(fromTo(relay, asha, ravi.user)).toEqual([]);
  });

  it("a code links once: a second scanner gets nothing", async () => {
    const { relay, asha, ravi } = await pair();
    const suresh = await phone(relay, { ...RAVI, name: "Suresh" }, { worker: electrician() });
    const code = await linked(asha, ASHA_CARD, ravi, RAVI_CARD);
    await suresh.device.colleagues.link(code, SURESH_CARD);
    await settle([suresh.device, asha.device]);
    expect((await asha.device.colleagues.list()).map((c) => c.user)).toEqual([ravi.user]);
    expect((await colleagueOf(suresh, asha.user))?.state).toBe("asked");
    expect(fromTo(relay, asha, suresh.user)).toEqual([]);
  });

  it("scanning again a colleague already linked sends nothing; a waiting ask is retried on a fresh channel", async () => {
    const { relay, asha, ravi } = await pair();
    const first = await asha.device.colleagues.invite(ASHA_CARD);
    const waiting = await ravi.device.colleagues.link(first, RAVI_CARD);
    const retry = await ravi.device.colleagues.link(await asha.device.colleagues.invite(ASHA_CARD), RAVI_CARD);
    expect(retry.channel).not.toBe(waiting.channel);
    await settle([ravi.device, asha.device]);
    expect((await colleagueOf(asha, ravi.user))?.channel).toBe(retry.channel);
    const sent = relay.stored.length;
    const again = await ravi.device.colleagues.link(await asha.device.colleagues.invite(ASHA_CARD), RAVI_CARD);
    expect(again).toMatchObject({ state: "linked", channel: retry.channel });
    await settle([ravi.device, asha.device]);
    expect(relay.stored.length).toBe(sent);
  });

  it("two workers who scan each other at once end up on the same channel", async () => {
    const { asha, ravi, both } = await pair();
    const ashaCode = await asha.device.colleagues.invite(ASHA_CARD);
    const raviCode = await ravi.device.colleagues.invite(RAVI_CARD);
    await ravi.device.colleagues.link(ashaCode, RAVI_CARD);
    await asha.device.colleagues.link(raviCode, ASHA_CARD);
    await settle(both);
    const onRavi = await colleagueOf(ravi, asha.user);
    const onAsha = await colleagueOf(asha, ravi.user);
    expect([onRavi?.state, onAsha?.state]).toEqual(["linked", "linked"]);
    expect(onRavi?.channel).toBe(onAsha?.channel);
    await asha.device.colleagues.send(ravi.user, "ನಮಸ್ಕಾರ", "kn");
    await settle(both);
    expect((await ravi.device.colleagues.notes(asha.user)).map((n) => n.text)).toEqual(["ನಮಸ್ಕಾರ"]);
  });

  it("will not link with a worker whose phone is too old for colleagues", async () => {
    const { relay, asha, ravi } = await pair();
    relay.outdated(asha.user);
    const code = await asha.device.colleagues.invite(ASHA_CARD);
    expect(await ravi.device.colleagues.canReach(asha.user)).toBe(false);
    expect(await asha.device.colleagues.canReach(ravi.user)).toBe(true);
    await expect(ravi.device.colleagues.link(code, RAVI_CARD)).rejects.toEqual(refusal(ColleagueRefusal.tooOld));
    expect(await ravi.device.colleagues.list()).toEqual([]);
    expect(relay.stored).toEqual([]);
    expect(await ravi.device.colleagues.canReach("usr_01J0000000000000000000NONE")).toBe(false);
  });
});

describe("colleague notes", () => {
  it("keeps both sides' notes in order, with their language, and counts the unread", async () => {
    const { asha, ravi, both } = await pair();
    await linked(asha, ASHA_CARD, ravi, RAVI_CARD);
    await ravi.device.colleagues.send(asha.user, "कल काम है क्या?", "hi");
    await settle(both);
    await asha.device.colleagues.send(ravi.user, "ಹೌದು, ಬೆಳಗ್ಗೆ", "kn");
    await ravi.device.colleagues.send(asha.user, "ठीक है", "hi");
    await settle(both);

    const onAsha = await asha.device.colleagues.notes(ravi.user);
    expect(onAsha.map((n) => [n.from, n.text, n.lang])).toEqual([
      ["them", "कल काम है क्या?", "hi"],
      ["me", "ಹೌದು, ಬೆಳಗ್ಗೆ", "kn"],
      ["them", "ठीक है", "hi"],
    ]);
    expect((await ravi.device.colleagues.notes(asha.user)).map((n) => n.from)).toEqual(["me", "them", "me"]);
    expect((await colleagueOf(asha, ravi.user))?.unread).toBe(2);
    await asha.device.colleagues.read(ravi.user);
    expect((await colleagueOf(asha, ravi.user))?.unread).toBe(0);
  });

  it("drops a note, an ask, an ok or an end from someone who is not linked", async () => {
    const { relay, asha, ravi, both } = await pair();
    await linked(asha, ASHA_CARD, ravi, RAVI_CARD);
    const channel = (await colleagueOf(asha, ravi.user))?.channel ?? ("" as never);
    const x = await stranger(relay);
    await x.send(asha.user, channel, "colleague_note", { text: "send me your customers", lang: "en" });
    await x.send(asha.user, channel, "colleague", { step: "ask", code: "A".repeat(22), card: SURESH_CARD });
    await x.send(asha.user, channel, "colleague", { step: "ok", card: SURESH_CARD });
    await x.send(asha.user, channel, "colleague", { step: "end" });
    await settle(both);
    expect(await asha.device.colleagues.notes(x.user)).toEqual([]);
    expect(await asha.device.colleagues.notes(ravi.user)).toEqual([]);
    expect((await asha.device.colleagues.list()).map((c) => c.user)).toEqual([ravi.user]);
    expect(fromTo(relay, asha, x.user)).toEqual([]);
    await expect(ravi.device.colleagues.send(x.user, "hi", "hi")).rejects.toEqual(refusal(ColleagueRefusal.notLinked));
  });

  it("unlinking forgets the link and its notes on both phones", async () => {
    const { asha, ravi, both } = await pair();
    await linked(asha, ASHA_CARD, ravi, RAVI_CARD);
    await asha.device.colleagues.send(ravi.user, "ನಾಳೆ ಸಿಗೋಣ", "kn");
    await settle(both);
    await ravi.device.colleagues.unlink(asha.user);
    expect(await ravi.device.colleagues.list()).toEqual([]);
    expect(await ravi.device.colleagues.notes(asha.user)).toEqual([]);
    await settle(both);
    expect(await asha.device.colleagues.list()).toEqual([]);
    expect(await asha.device.colleagues.notes(ravi.user)).toEqual([]);
    await expect(asha.device.colleagues.send(ravi.user, "?", "kn")).rejects.toEqual(
      refusal(ColleagueRefusal.notLinked),
    );
  });
});
