import { AccessRequest, Decision, Grant } from "@gigsync/protocol";
import vectors from "@gigsync/protocol/vectors/policy.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { decide } from "../src/index.js";

describe("policy engine against shared vectors", () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const grants = c.grants.map((g) => Grant.parse(g));
      const request = AccessRequest.parse(c.request);
      expect(decide(grants, request)).toEqual(Decision.parse(c.expected));
    });
  }
});
