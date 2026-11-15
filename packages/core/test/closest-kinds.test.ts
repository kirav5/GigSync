import type { WorkKind } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { closestKinds, MAX_CLOSEST } from "../src/index.js";

/** Words a worker might type or say for work not named on the list, and the kind each should be offered first. */
const SAID: readonly (readonly [string, WorkKind])[] = [
  ["i sharpen wood", "carpenter"],
  ["carpentar", "carpenter"],
  ["lakdi ka kaam", "carpenter"],
  ["bal kaatna", "barber"],
  ["बाल काटना", "barber"],
  ["ಕೂದಲು ಕತ್ತರಿಸುವುದು", "barber"],
  ["silai karti hoon", "tailor"],
  ["ಬಟ್ಟೆ ಹೊಲಿಯುವುದು", "tailor"],
  ["gaadi chalata hoon", "driver"],
  ["phone screen repair", "mobile_repair"],
  ["bacchon ko padhana", "school_tutor"],
  ["ped paudhe ki dekhbhal", "gardener"],
  ["दीवार पर प्लास्टर", "mason"],
  ["नल ठीक करना", "plumber"],
  ["i fix fans", "electrician"],
];

describe("the kinds of work a worker's own words are closest to", () => {
  for (const [words, kind] of SAID) {
    it(`offers ${kind} first for "${words}"`, () => {
      expect(closestKinds(words)[0]).toBe(kind);
    });
  }

  it("offers a few kinds when the words fit several, never more than the limit", () => {
    expect(closestKinds("chappal silna")).toEqual(expect.arrayContaining(["tailor", "cobbler"]));
    expect(closestKinds("cleaning").length).toBeLessThanOrEqual(MAX_CLOSEST);
  });

  it("offers nothing for a word many kinds share, or words that name no work", () => {
    expect(closestKinds("repair")).toEqual([]);
    expect(closestKinds("xyz qwerty")).toEqual([]);
    expect(closestKinds("i do work")).toEqual([]);
    expect(closestKinds("")).toEqual([]);
  });
});
