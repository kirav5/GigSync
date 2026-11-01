import { Lang, PAISE_PER_RUPEE, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  ChatIntent,
  ChatRole,
  type IntentContext,
  MODEL_ROUTE_TIMEOUT_MS,
  modelRoute,
  NoModel,
  RouteVia,
  routeChat,
} from "../src/index.js";
import { FakeModel, Hang } from "./model-fakes.js";

/** The phone's model names the intent (ADR 0040); core checks every value, and the word lists answer otherwise. */

const I = ChatIntent;
const worker: IntentContext = {
  lang: Lang.enum.en,
  role: ChatRole.worker,
  contacts: ["Meera"],
  trades: [Trade.enum.cook],
};
const household: IntentContext = { lang: Lang.enum.en, role: ChatRole.household, contacts: [] };
const reply = (value: object) => new FakeModel(JSON.stringify(value));
const FAIR = "is ₹8,000 fair for a cook?";

describe("modelRoute", () => {
  it("takes a good reply, with the amount the owner said as paise", async () => {
    const model = reply({ intent: "market", trade: "cook", amount: 8000 });
    expect(await modelRoute(FAIR, household, model)).toEqual({
      intent: I.market,
      slots: { trade: "cook", amount_paise: 8000 * PAISE_PER_RUPEE },
      via: RouteVia.model,
    });
    expect(model.prompts[0]).toContain(JSON.stringify(FAIR));
    expect(model.options[0]?.temperature).toBe(0);
    expect(model.options[0]?.json).toBe(true);
  });

  it("reads JSON wrapped in prose or fences, slots nested or not, and digits in any script", async () => {
    const fenced = new FakeModel('Sure!\n```json\n{"intent":"market","slots":{"trade":"maid","amount":"₹5,000"}}\n```');
    expect(await modelRoute("मेड को ५००० देना ठीक है?", household, fenced)).toMatchObject({
      intent: I.market,
      slots: { trade: "maid", amount_paise: 5000 * PAISE_PER_RUPEE },
    });
    expect(await modelRoute("Meera kahan hai", worker, reply({ intent: "askContact", contact: "meera" }))).toEqual({
      intent: I.askContact,
      slots: { contact: "Meera" },
      via: RouteVia.model,
    });
  });

  it("keeps a note cut from the owner's words, and an area they named", async () => {
    const note = reply({ intent: "remember", note: "Kabir pays on the 5th." });
    expect((await modelRoute("remember Kabir pays on the 5th", worker, note))?.slots).toEqual({
      note: "Kabir pays on the 5th",
    });
    const area = reply({ intent: "market", trade: "painter", area: "HSR Layout" });
    expect((await modelRoute("painters in HSR, what do they take?", household, area))?.slots).toEqual({
      trade: "painter",
      area: "hsr_layout",
    });
  });

  it("gives nothing for bad JSON, no model, or an unknown intent or trade", async () => {
    expect(await modelRoute(FAIR, worker, new FakeModel("market, cook"))).toBeUndefined();
    expect(await modelRoute(FAIR, worker, new FakeModel('{"intent": "market"'))).toBeUndefined();
    expect(await modelRoute(FAIR, worker, new NoModel())).toBeUndefined();
    expect(await modelRoute(FAIR, worker, new FakeModel(new Error("engine")))).toBeUndefined();
    expect(await modelRoute(FAIR, worker, reply({ intent: "price" }))).toBeUndefined();
  });

  it("gives nothing when the model is slower than the limit", async () => {
    expect(MODEL_ROUTE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(await modelRoute(FAIR, worker, new FakeModel(Hang), { timeoutMs: 10 })).toBeUndefined();
  });

  it("gives nothing for an intent this chat cannot have", async () => {
    for (const intent of [I.editCard, I.helpOffer, I.helpStop, I.moving, I.earnings])
      expect(await modelRoute("change my rate", household, reply({ intent, field: "rate" }))).toBeUndefined();
    expect(await modelRoute("where is a room?", worker, reply({ intent: "guide" }))).toBeUndefined();
    expect(await modelRoute("where is a room?", { ...worker, inMove: true }, reply({ intent: "guide" }))).toEqual({
      intent: I.guide,
      slots: {},
      via: RouteVia.model,
    });
  });

  it("drops a slot core cannot verify and keeps the intent", async () => {
    const notSaid = reply({ intent: "market", trade: "cook", amount: 9000 });
    expect(await modelRoute(FAIR, worker, notSaid)).toEqual({
      intent: I.market,
      slots: { trade: "cook" },
      via: RouteVia.model,
    });
    const unknownArea = reply({ intent: "market", trade: "cook", area: "malleshwaram" });
    expect((await modelRoute("cook rate in Malleshwaram", worker, unknownArea))?.slots).toEqual({ trade: "cook" });
    const areaNotNamed = reply({ intent: "market", trade: "cook", area: "jayanagar" });
    expect((await modelRoute(FAIR, household, areaNotNamed))?.slots).toEqual({ trade: "cook" });
    const madeUp = reply({ intent: "find", trade: "chef", field: "salary", city: "mumbai" });
    expect(await modelRoute("need someone for the kitchen", household, madeUp)).toEqual({
      intent: I.find,
      slots: {},
      via: RouteVia.model,
    });
    expect((await modelRoute("change it", worker, reply({ intent: "editCard", field: "price" })))?.slots).toEqual({});
    const oddShapes = reply({ intent: "find", trade: 7, contact: "x".repeat(500), area: ["hsr"] });
    expect((await modelRoute("need help at home", household, oddShapes))?.intent).toBe(I.find);
  });

  it("finds the contact the model spelt in another script", async () => {
    const hindi = { ...worker, lang: Lang.enum.hi, contacts: ["रवि", "मीना"] };
    expect(await modelRoute("रवि को मत बताना", hindi, reply({ intent: "setRule", contact: "Ravi" }))).toEqual({
      intent: I.setRule,
      slots: { contact: "रवि" },
      via: RouteVia.model,
    });
  });

  it("drops a contact the message does not name, though the owner has it", async () => {
    const model = reply({ intent: "askContact", contact: "Meera" });
    expect(await modelRoute("is my sister free today?", worker, model)).toBeUndefined();
  });

  it("shows examples only in the script the message is written in", async () => {
    const kannada = { ...worker, lang: Lang.enum.kn };
    const script = reply({ intent: "chat" });
    await modelRoute("ನಮಸ್ಕಾರ", kannada, script);
    expect(script.prompts[0]).toContain("ನನಗೆ ಪ್ಲಂಬರ್ ಬೇಕು");
    expect(script.prompts[0]).not.toContain("nanna area badlaayisi");
    const latin = reply({ intent: "chat" });
    await modelRoute("namaskara", kannada, latin);
    expect(latin.prompts[0]).toContain("nanna area badlaayisi");
    expect(latin.prompts[0]).not.toContain("ನನಗೆ ಪ್ಲಂಬರ್ ಬೇಕು");
    const english = reply({ intent: "chat" });
    await modelRoute("hello", worker, english);
    expect(english.prompts[0]).toContain("need an electrician tomorrow");
    expect(english.prompts[0]).not.toContain("madad band karo");
  });

  it("asks for a reply held to this chat's intents and the owner's contacts", async () => {
    const model = reply({ intent: "chat" });
    await modelRoute("hello", worker, model);
    const schema = model.options[0]?.schema as { properties: Record<string, { enum?: string[] }>; required: string[] };
    expect(schema.required).toEqual(["intent"]);
    expect(schema.properties.contact?.enum).toEqual(["Meera"]);
    expect(schema.properties.intent?.enum).toContain(I.setRule);
    const forHousehold = reply({ intent: "chat" });
    await modelRoute("hello", household, forHousehold);
    const householdSchema = forHousehold.options[0]?.schema as { properties: Record<string, { enum?: string[] }> };
    expect(householdSchema.properties.intent?.enum).not.toContain(I.editCard);
    expect(householdSchema.properties.contact).toBeUndefined();
  });

  it("gives nothing when what the action needs fails: a contact the owner has, a note in their words, a trade", async () => {
    expect(await modelRoute("is Raju free?", worker, reply({ intent: "askContact", contact: "Raju" }))).toBeUndefined();
    expect(await modelRoute("is she free?", worker, reply({ intent: "askContact" }))).toBeUndefined();
    expect(await modelRoute("let Raju see me", worker, reply({ intent: "setRule", contact: "Raju" }))).toBeUndefined();
    const madeUpNote = reply({ intent: "remember", note: "Kabir pays on the 6th" });
    expect(await modelRoute("remember Kabir pays on the 5th", worker, madeUpNote)).toBeUndefined();
    expect(await modelRoute("what's the going rate?", household, reply({ intent: "market" }))).toBeUndefined();
    expect((await modelRoute("what's the going rate?", worker, reply({ intent: "market" })))?.intent).toBe(I.market);
  });
});

describe("routeChat", () => {
  it("uses the model's route when it checks", async () => {
    const route = await routeChat(FAIR, worker, reply({ intent: "market", trade: "cook", amount: 8000 }));
    expect(route).toMatchObject({ intent: I.market, via: RouteVia.model });
  });

  it("falls back to the word lists when the model gives nothing usable", async () => {
    const text = "remember Kabir prefers tea";
    const fallback = { intent: I.remember, slots: { note: "Kabir prefers tea" }, via: RouteVia.keywords };
    expect(await routeChat(text, worker, new NoModel())).toEqual(fallback);
    expect(await routeChat(text, worker, new FakeModel("no idea"))).toEqual(fallback);
    expect(await routeChat(text, worker, new FakeModel(Hang), { timeoutMs: 10 })).toEqual(fallback);
  });
});
