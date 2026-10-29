import {
  ApiClient,
  type ColleagueError,
  ColleagueRefusal,
  GigDevice,
  Header,
  MemoryStorage,
  SecretKeys,
  SystemClock,
  type WorkerRules,
} from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { COLLEAGUE_PROTOCOL, type ColleagueCard, type EngagementId, type Trade } from "@gigsync/protocol";
import { beforeAll, describe, expect, it } from "vitest";
import { API, near, need, newCentre, newPhone, type Person, person, talk } from "./world.js";

const DEV_OTP = process.env.DEV_OTP ?? "000000";
const IP_OCTET = 250;
const octet = () => Math.floor(Math.random() * IP_OCTET);
const centre = newCentre();

/**
 * One person's phone, signed in as an app that understands colleague and referral envelopes. world.ts's `person`
 * signs in as an older app (protocol 1), which is what the refusal test below needs from it.
 */
async function colleaguePhone(name: string, rules?: WorkerRules, autoConfirm = false): Promise<Person> {
  const ip = `10.${octet()}.${octet()}.${octet()}`;
  const anon = new ApiClient(API, (input, init) =>
    fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), [Header.cfConnectingIp]: ip } }),
  );
  const keys = new SecretKeys(newDeviceSecrets());
  const phone = newPhone();
  const session = await anon.verifyOtp(phone, DEV_OTP, { ...(await keys.publicKeys()), protocol: COLLEAGUE_PROTOCOL });
  const contact = { name, phone };
  const device = new GigDevice({
    relay: anon.as(session),
    storage: new MemoryStorage(),
    keys,
    clock: new SystemClock(),
    me: { user: session.user, device: session.device },
    contact,
    autoConfirm,
    ...(rules ? { worker: rules } : {}),
  });
  return { name, contact, session, api: anon.as(session), keys, device };
}

const rules = (trade: Trade, extra: Partial<WorkerRules> = {}): WorkerRules => ({
  trades: [trade],
  rate: { opening_paise: 70000, limit_paise: 55000 },
  base: centre,
  radius_km: 10,
  ...extra,
});
const card = (p: Person, trade: Trade): ColleagueCard => ({ name: p.name, trades: [trade], languages: ["hi", "en"] });

let ravi: Person; // electrician, wants to see requests with pets first
let suresh: Person; // electrician, his colleague, lets his agent sign
let priya: Person; // household

beforeAll(async () => {
  [ravi, suresh, priya] = await Promise.all([
    colleaguePhone("Ravi", rules("electrician", { ask_me: ["pets"] })),
    colleaguePhone("Suresh", rules("electrician"), true),
    colleaguePhone("Priya", undefined, true),
  ]);
});

describe("colleagues through the real API", () => {
  it("two workers link by code and write to each other; the server only ever holds ciphertext", async () => {
    const code = await ravi.device.colleagues.invite(card(ravi, "electrician"));
    await suresh.device.colleagues.link(code, card(suresh, "electrician"));
    await talk(suresh, ravi);
    const onRavi = (await ravi.device.colleagues.list()).find((c) => c.user === suresh.session.user);
    const onSuresh = (await suresh.device.colleagues.list()).find((c) => c.user === ravi.session.user);
    expect([onRavi?.state, onSuresh?.state]).toEqual(["linked", "linked"]);
    expect(onRavi?.channel).toBe(onSuresh?.channel);

    await suresh.device.colleagues.send(ravi.session.user, "कल वायरिंग का काम है, साथ चलोगे?", "hi");
    await suresh.device.sync();
    const raw = JSON.stringify(await ravi.api.inbox());
    expect(raw).toContain(onRavi?.channel);
    expect(raw).not.toContain("वायरिंग");
    await talk(ravi, suresh);
    const [note] = await ravi.device.colleagues.notes(suresh.session.user);
    expect(note).toMatchObject({ from: "them", text: "कल वायरिंग का काम है, साथ चलोगे?", lang: "hi" });
    expect((await ravi.device.colleagues.list())[0]?.unread).toBe(1);
  });

  it("a worker who declines suggests his colleague, and the household asks him the same need", async () => {
    const [job] = await priya.device.request(
      need("electrician", near(centre, 1), 65000, "Ceiling fan stopped working", { problem: "dead", pets: "yes" }),
      [ravi.session.user],
    );
    const id = job?.engagement.id as EngagementId;
    await talk(priya, ravi);
    await ravi.device.declineRequest(id);
    await talk(priya, ravi);
    await ravi.device.colleagues.suggest(id, suresh.session.user);
    await talk(ravi, priya);
    expect((await priya.device.job(id)).referral).toMatchObject({ colleague: suresh.session.user });

    const [asked] = await priya.device.colleagues.askReferred(id);
    const askedId = asked?.engagement.id as EngagementId;
    await talk(priya, suresh);
    expect((await suresh.device.job(askedId)).request.need).toBe("Ceiling fan stopped working");
    expect((await priya.device.job(askedId)).engagement.status).toBe("agreed");
  });

  it("refuses to link with a phone that runs an older GigSync", async () => {
    const old = await person("Old phone", { worker: rules("plumber") });
    expect(await ravi.device.colleagues.canReach(old.session.user)).toBe(false);
    const code = await old.device.colleagues.invite(card(old, "plumber"));
    await expect(ravi.device.colleagues.link(code, card(ravi, "electrician"))).rejects.toEqual(
      expect.objectContaining({ reason: ColleagueRefusal.tooOld }) as ColleagueError,
    );
  });
});
