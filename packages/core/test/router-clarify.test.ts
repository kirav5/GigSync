import { Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CardKind,
  ChatIntent,
  ChatRole,
  ChatSide,
  CLARIFY,
  choicesOf,
  chosenRoute,
  clarifyCard,
  type IntentContext,
  intentIndex,
  MAX_CHOICES,
  meaningRoute,
  modelRoute,
  RECENT_LINE_CHARS,
  RECENT_LINES,
  RouteVia,
  replySchema,
  routePrompt,
} from "../src/index.js";
import { BagOfWordsEmbedder } from "./embedder-fakes.js";
import { FakeModel } from "./model-fakes.js";

/**
 * Asking when unsure, and the chat so far (ADR 0042 amendment 2026-11-03): the phone's model may answer "clarify"
 * with the intents a message could mean, which core checks and the chat asks about; it reads the last few lines.
 */

const I = ChatIntent;
const worker: IntentContext = {
  lang: Lang.enum.en,
  role: ChatRole.worker,
  contacts: ["Meera"],
  trades: [Trade.enum.cook],
};
const talk: IntentContext = { ...worker, mayAsk: true };
const BOOKING = "I have a booking from 2-3PM tomorrow";
const reply = (value: object) => new FakeModel(JSON.stringify(value));

describe("the model asks instead of guessing", () => {
  it("names the intents it is torn between, the first as the route, for the chat to ask", async () => {
    const route = await modelRoute(BOOKING, talk, reply({ intent: CLARIFY, options: ["remember", "find"] }));
    expect(route).toEqual({
      intent: I.remember,
      slots: { note: BOOKING },
      via: RouteVia.model,
      unsure: [I.remember, I.find],
    });
  });

  it("keeps only intents this chat can act on, once each, at most three", async () => {
    // askContact names no contact the owner has; a household has no card to edit; chat is the question's own last choice.
    const options = ["askContact", "remember", "remember", "chat", "find", "askSelf", "market"];
    const route = await modelRoute(BOOKING, talk, reply({ intent: CLARIFY, options }));
    expect(route?.unsure).toEqual([I.remember, I.find, I.askSelf]);
    expect(route?.unsure).toHaveLength(MAX_CHOICES);
    const household = { ...talk, role: ChatRole.household };
    expect(
      (await modelRoute(BOOKING, household, reply({ intent: CLARIFY, options: ["editCard", "find"] })))?.unsure,
    ).toBeUndefined();
  });

  it("takes the one intent left as the route, and nothing when none is left", async () => {
    const one = await modelRoute(BOOKING, talk, reply({ intent: CLARIFY, options: ["find", "askContact"] }));
    expect(one).toMatchObject({ intent: I.find, via: RouteVia.model });
    expect(one?.unsure).toBeUndefined();
    expect(await modelRoute(BOOKING, talk, reply({ intent: CLARIFY, options: [] }))).toBeUndefined();
  });

  it("never asks where the chat cannot (Find): clarify is not one of its intents", async () => {
    expect(
      await modelRoute(BOOKING, worker, reply({ intent: CLARIFY, options: ["remember", "find"] })),
    ).toBeUndefined();
    expect(replySchema(worker).properties).not.toHaveProperty("options");
    expect(routePrompt(BOOKING, worker)).not.toContain(CLARIFY);
    const schema = replySchema(talk) as { properties: { intent: { enum: string[] } } };
    expect(schema.properties.intent.enum).toContain(CLARIFY);
    expect(routePrompt(BOOKING, talk)).toContain(`"intent":"${CLARIFY}"`);
  });
});

describe("what the owner picks", () => {
  it("routes their first words as the intent picked, with the slots the words give", () => {
    expect(chosenRoute(I.remember, BOOKING, talk)).toEqual({
      intent: I.remember,
      slots: { note: BOOKING },
      via: RouteVia.owner,
    });
    expect(chosenRoute(I.find, BOOKING, talk)).toMatchObject({ intent: I.find, via: RouteVia.owner });
    expect(chosenRoute(I.askContact, BOOKING, talk)).toBeUndefined();
  });

  it("asks with one choice per intent and Something else last, once", () => {
    expect(choicesOf([I.remember, I.find])).toEqual([I.remember, I.find, I.chat]);
    expect(choicesOf([I.chat, I.remember])).toEqual([I.remember, I.chat]);
    expect(clarifyCard([I.remember, I.find])).toEqual({
      kind: CardKind.clarify,
      say: { key: "agent.clarify" },
      choices: [I.remember, I.find, I.chat],
    });
  });
});

describe("the chat so far", () => {
  it("shows the model the last few lines, oldest first, each cut short", () => {
    const long = "x".repeat(RECENT_LINE_CHARS + 50);
    const recent = [
      { side: ChatSide.owner, text: "first, too old to show" },
      ...Array.from({ length: RECENT_LINES - 1 }, (_, i) => ({ side: ChatSide.agent, text: `line ${i}` })),
      { side: ChatSide.owner, text: long },
    ];
    const prompt = routePrompt("save it", { ...talk, recent });
    expect(prompt).not.toContain("too old to show");
    expect(prompt).toContain('agent: "line 0"');
    expect(prompt).toContain(`owner: "${"x".repeat(RECENT_LINE_CHARS)}…"`);
    expect(prompt.indexOf("line 0")).toBeLessThan(prompt.indexOf('Message: "save it"'));
    expect(routePrompt("save it", talk)).not.toContain("The chat so far");
  });
});

describe("a note the embedding model hears", () => {
  it("is the whole message when no note was cut from it", async () => {
    const index = intentIndex(new BagOfWordsEmbedder());
    await index.warm();
    const route = await meaningRoute("keep a note: bring my own ladder", worker, index);
    expect(route).toMatchObject({ intent: I.remember, via: RouteVia.meaning });
    expect(route?.slots.note).toBeTruthy();
  });
});
