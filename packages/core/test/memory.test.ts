import { Role, SKIPPED } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  Collection,
  FORGET_ALL,
  forgetMemory,
  type JobRecord,
  listMemory,
  MemoryItemKind,
  recall,
  remember,
  summary,
  wipeMemory,
} from "../src/index.js";
import { HOME, job, WORKER, writer } from "./memory-fixtures.js";

const R = Role.enum;
const ASHA = { name: "Asha", phone: "+919800000303" };
const RAVI_HOME = { name: "Ravi", phone: "+919800000404", address: "12, 4th Block, Koramangala" };

describe("agent memory: what is kept", () => {
  it("household: keeps its own stable facts, the area and the worker's name, never their phone", async () => {
    const home = writer(HOME);
    const done = job({ details: { people: "4", problem: "none" }, answers: { meals: "2", pets: "no" }, contact: ASHA });
    await remember(home, done);
    const known = await recall(home, "cook", WORKER);
    expect(known.facts).toEqual({ people: "4", meals: "2", pets: "no" });
    expect(known.person).toMatchObject({ name: "Asha", role: R.provider, jobs: 1, trades: ["cook"] });
    expect(JSON.stringify(known)).not.toContain("900000");
    const stored = JSON.stringify(await home.storage.list(Collection.memory));
    expect(stored).not.toContain(ASHA.phone);
    expect(stored).not.toContain("problem");
    const items = await listMemory(home);
    expect(items.find((i) => i.kind === MemoryItemKind.area)).toBeDefined();
    const person = items.find((i) => i.kind === MemoryItemKind.person);
    expect(person?.kind === MemoryItemKind.person && person.person.last_price_paise).toBe(900000);
  });

  it("worker: keeps the household's details and what was asked, never their phone or address", async () => {
    const ravi = writer(WORKER);
    const served = job({
      role: R.provider,
      details: { people: "4" },
      answers: { meals: "2", ask_a: "yes", pets: SKIPPED },
      questions: ["meals", "pets"],
      contact: RAVI_HOME,
    });
    await remember(ravi, served);
    const known = await recall(ravi, "cook", HOME);
    expect(known.facts).toEqual({});
    expect(known.person).toMatchObject({ name: "Ravi", role: R.requester, details: { people: "4", meals: "2" } });
    expect(known.askedBefore.map((a) => [a.key, a.answered])).toEqual([
      ["meals", true],
      ["pets", false],
    ]);
    const stored = JSON.stringify(await ravi.storage.list(Collection.memory));
    expect(stored).not.toContain(RAVI_HOME.phone);
    expect(stored).not.toContain("Koramangala");
  });

  it("keeps a question the worker's model wrote by its text", async () => {
    const ravi = writer(WORKER);
    const questions: JobRecord["questions"] = [
      { key: "ask_a", text: "Is there a balcony to clean?", lang: "en", kind: "yes_no", by: "model" },
    ];
    await remember(ravi, job({ role: R.provider, questions, answers: { ask_a: "yes" } }));
    const [asked] = (await recall(ravi, "cook")).askedBefore;
    expect(asked).toMatchObject({ key: "ask_a", text: "Is there a balcony to clean?", answered: true });
  });

  it("summary: plain English for a prompt, with no name, price, phone or address", async () => {
    const ravi = writer(WORKER);
    await remember(
      ravi,
      job({ role: R.provider, details: { people: "4", pets: "yes" }, questions: ["meals"], contact: RAVI_HOME }),
    );
    const text = await summary(ravi, "cook", HOME);
    expect(text).toContain("1 signed job(s) with this household");
    expect(text).toContain("Last time they said: pets yes; people 4.");
    expect(text).toContain("Asked before for cook jobs: meals (not answered)");
    for (const secret of ["Ravi", "9000", "₹", RAVI_HOME.phone, "Koramangala"]) expect(text).not.toContain(secret);
    expect(await summary(writer(WORKER), "cook", HOME)).toBe("");
  });
});

describe("agent memory: what is never kept", () => {
  it("an unsigned job: the household keeps only its own facts, the worker nothing", async () => {
    const home = writer(HOME);
    await remember(home, job({ details: { rooms: "3" }, signed: false, contact: ASHA }));
    const known = await recall(home, "cook", WORKER);
    expect(known.facts).toEqual({ rooms: "3" });
    expect(known.person).toBeUndefined();

    const ravi = writer(WORKER);
    await remember(ravi, job({ role: R.provider, details: { rooms: "3" }, questions: ["rooms"], signed: false }));
    expect(await listMemory(ravi)).toEqual([]);
  });

  it("a skipped answer, and values that look like a phone, account, UPI ID, email or link", async () => {
    const home = writer(HOME);
    const details = {
      area_sqft: SKIPPED,
      route: "call me on 98450 12345",
      rooms: "pay to priya@okaxis",
      people: "see https://example.com",
      meals: "೯೮೪೫೦೧೨೩೪೫",
      pets: "yes",
    };
    await remember(home, job({ details }));
    expect((await recall(home, "cook")).facts).toEqual({ pets: "yes" });
  });
});

describe("agent memory: newest wins, counted once", () => {
  it("a later job's value replaces an older one, and remembering a job twice counts it once", async () => {
    const day1 = writer(HOME, "2026-09-01");
    await remember(day1, job({ id: "eng_01A", details: { rooms: "2" } }));
    const day2 = { ...day1, clock: { now: () => new Date("2026-10-01T09:00:00Z") } };
    const second = job({ id: "eng_01B", details: { rooms: "3" } });
    await remember(day2, second);
    await remember(day2, { ...second, contact: ASHA });
    const known = await recall(day2, "cook", WORKER);
    expect(known.facts.rooms).toBe("3");
    expect(known.person).toMatchObject({ jobs: 2, name: "Asha", last_on: "2026-10-01" });
  });

  it("each owner on a shared phone has their own memory", async () => {
    const home = writer(HOME);
    await remember(home, job({ details: { rooms: "3" } }));
    const other = { ...home, me: { user: WORKER } };
    expect(await listMemory(other)).toEqual([]);
  });
});

describe("agent memory: forget", () => {
  it("forgets one item by its key, and everything with FORGET_ALL", async () => {
    const home = writer(HOME);
    await remember(home, job({ details: { rooms: "3", pets: "no" }, contact: ASHA }));
    await forgetMemory(home, "fact:rooms");
    expect((await recall(home, "cook")).facts).toEqual({ pets: "no" });
    await forgetMemory(home, "nonsense");
    await forgetMemory(home, "fact:not_a_key");
    expect((await recall(home, "cook")).facts).toEqual({ pets: "no" });
    await forgetMemory(home, FORGET_ALL);
    expect(await listMemory(home)).toEqual([]);
  });

  it("a forgotten person does not come back when the same job's card arrives late", async () => {
    const home = writer(HOME);
    const done = job({ details: { rooms: "3" } });
    await remember(home, done);
    await forgetMemory(home, `person:${WORKER}`);
    await remember(home, { ...done, contact: ASHA });
    expect((await recall(home, "cook", WORKER)).person).toBeUndefined();
  });

  it("sign-out wipes every owner's memory on the phone", async () => {
    const home = writer(HOME);
    await remember(home, job({ details: { rooms: "3" } }));
    await remember({ ...home, me: { user: WORKER } }, job({ role: R.provider, details: { rooms: "3" } }));
    await wipeMemory(home.storage);
    expect(await home.storage.list(Collection.memory)).toEqual([]);
  });
});
