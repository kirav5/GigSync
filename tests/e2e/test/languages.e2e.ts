import { type Advice, questionText, ReasonKind, reasonText, TaskKind, type WorkerRules } from "@gigsync/core";
import { type Clarify, type EngagementId, Lang, QuestionKey, type RateCard, SEED_SIGNER } from "@gigsync/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { near, newCentre, type Person, person, talk, testPayee } from "./world.js";

/**
 * Agent-flows §1 through the real API: a Hindi-speaking cook and a Kannada-speaking household find each other on the
 * board, and their agents agree a month's cooking with no shared language, no model setting the price, and nothing
 * readable on the server.
 */

const DEVANAGARI = /[ऀ-ॿ]/;
const KANNADA = /[ಀ-೿]/;

/** Bengaluru's cook band, as the union's rate card might seed the city pack. */
const RATES: RateCard = {
  city: "Bengaluru",
  version: 1,
  signed_by: SEED_SIGNER,
  bands: [
    {
      trade: "cook",
      low_paise: 750000,
      high_paise: 950000,
      scope: [
        { kind: "flag", key: "pets", percent: 15 },
        { kind: "count", key: "people", percent: 10, included: 3 },
      ],
    },
  ],
};
const FLOOR = 800000;
/** Pets add 15% to the band: ₹8,630–₹10,930, rounded up to ₹10. */
const SCOPED = { opening_paise: 1093000, limit_paise: 863000 };
const RAVI_LIMIT = 950000;

const centre = newCentre();
let asha: Person;
let meena: Person;

async function cook(name: string, north: number, rules: Partial<WorkerRules> = {}): Promise<Person> {
  const where = near(centre, north);
  const p = await person(name, {
    lang: Lang.enum.hi,
    worker: {
      trades: ["cook"],
      rate: { opening_paise: 950000, limit_paise: FLOOR },
      base: where,
      radius_km: 5,
      rates: RATES,
      ...rules,
    },
    payee: testPayee(name),
  });
  await p.api.publishProfile({
    display_name: name,
    trades: ["cook"],
    area: where,
    area_name: "Koramangala",
    rate_paise: 950000,
    languages: ["hi"],
    about: "North Indian and South Indian cooking",
  });
  return p;
}

beforeAll(async () => {
  asha = await cook("Asha", 0.5, { ask_me: ["pets"] });
  meena = await cook("Meena", 3.5);
});

afterAll(async () => {
  await Promise.all([asha, meena].map((w) => w.api.removeProfile()));
});

describe("a Hindi-speaking cook and a Kannada-speaking household, end to end", () => {
  it("find, ask in keys, stop for the dog, price from the band, negotiate, sign, swap contacts, note in Hindi", async () => {
    const ravi = await person("Ravi", { lang: Lang.enum.kn, address: "12, 4th Block, Koramangala" });

    // Discovery: nearest first, the card says Asha speaks Hindi; no phone on the board.
    const found = await ravi.api.searchWorkers({ trade: "cook", ...centre, radius_km: 5 });
    expect(found.map((w) => w.display_name)).toEqual(["Asha", "Meena"]);
    expect(found[0]?.languages).toEqual(["hi"]);

    const need = "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು";
    const [job] = await ravi.device.request(
      {
        trade: "cook",
        need,
        when: "mon–sat 07:00–10:00",
        area: centre,
        budget: { opening_paise: 700000, limit_paise: RAVI_LIMIT },
      },
      [asha.session.user],
    );
    const id = job?.engagement.id as EngagementId;
    await ravi.device.sync();
    const raw = JSON.stringify(await asha.api.inbox());
    expect(raw).toContain(id);
    expect(raw).not.toMatch(KANNADA); // the server holds ciphertext only

    // Asha's agent asked the cook's questions as keys; Ravi reads them in Kannada.
    await talk(ravi, asha);
    expect((await asha.device.job(id)).request.lang).toBe(Lang.enum.kn);
    const [ask] = await ravi.device.tasks();
    expect(ask?.kind).toBe(TaskKind.answerQuestions);
    const keys = ((ask?.detail ?? []) as Clarify["questions"]).map((q) => QuestionKey.parse(q.key));
    expect(keys).toEqual(["people", "meals", "pets"]);
    for (const k of keys) expect(questionText(Lang.enum.kn, k)).toMatch(KANNADA);

    // Ravi answers in Kannada; three people in Kannada digits; pets from the app's toggle.
    await ravi.device.answer(id, { people: "೩", meals: "ಬೆಳಗ್ಗೆ ಮತ್ತು ರಾತ್ರಿ", pets: "yes" });
    await talk(ravi, asha);

    // Pets is on Asha's list: her agent planned the job and shows it to her, in Hindi, before quoting anything.
    const [show] = await asha.device.tasks();
    expect(show?.kind).toBe(TaskKind.approveRequest);
    const { advice } = (show?.detail ?? {}) as { advice: Advice };
    expect(advice.mandate).toEqual(SCOPED);
    const spoken = advice.reasons.map((r) => reasonText(Lang.enum.hi, r));
    for (const line of spoken) expect(line).toMatch(DEVANAGARI);
    expect(spoken.join(" ")).toContain("₹10,930");
    expect(advice.reasons).toContainEqual({ kind: ReasonKind.scope, key: "pets", percent: 15 });
    expect((await asha.device.job(id)).offers).toEqual([]);

    // She says yes; the agents negotiate on their own curves until one accepts; then both owners sign.
    await asha.device.approveRequest(id);
    await talk(ravi, asha);
    for (let turn = 0; turn < 2; turn++) {
      for (const p of [asha, ravi]) {
        const [t] = await p.device.tasks();
        if (t?.kind === TaskKind.confirmDeal) await p.device.confirmDeal(id);
      }
      await talk(ravi, asha);
    }

    const onAsha = await asha.device.job(id);
    const onRavi = await ravi.device.job(id);
    expect([onAsha.engagement.status, onRavi.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(onAsha.mine?.terms_hash).toBe(onRavi.mine?.terms_hash);
    const price = onAsha.mine?.terms.price_paise as number;
    expect(price).toBeGreaterThanOrEqual(SCOPED.limit_paise);
    expect(price).toBeLessThanOrEqual(RAVI_LIMIT);
    const hers = onAsha.offers.filter((o) => o.by === "provider").map((o) => o.offer.price_paise);
    expect(hers[0]).toBe(SCOPED.opening_paise);
    expect(onRavi.contact).toEqual(asha.contact);
    expect(onAsha.contact).toEqual(ravi.contact);

    // Asha says she has left, in Hindi; Ravi's phone keeps it as said, marked Hindi, to translate under the original.
    await asha.device.update(id, "निकल गई हूँ");
    await talk(ravi, asha);
    expect((await ravi.device.job(id)).notes).toEqual([{ text: "निकल गई हूँ", lang: Lang.enum.hi }]);
  });
});
