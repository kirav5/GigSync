import { describe, expect, it } from "vitest";
import { codeIn, qrLink, qrOwner } from "../src/index.js";

const CODE = "abcDEF012_-x";

describe("QR links", () => {
  it("puts the code in the app's address and reads it back", () => {
    const link = qrLink("https://gigsync.app/#/find", CODE);
    expect(link).toBe(`https://gigsync.app/?to=${CODE}`);
    expect(codeIn(link)).toBe(CODE);
    expect(codeIn(` ${link} `)).toBe(CODE);
  });

  it("reads nothing from text that is not a QR link with a good code", () => {
    expect(codeIn(CODE)).toBeUndefined();
    expect(codeIn("https://gigsync.app/?to=short")).toBeUndefined();
    expect(codeIn("upi://pay?pa=ravi@okaxis")).toBeUndefined();
    expect(codeIn("not a link")).toBeUndefined();
  });

  it("shows the first word of the owner's name", () => {
    expect(qrOwner("  Priya   Sharma ", "household")).toEqual({ role: "household", first_name: "Priya" });
    expect(qrOwner("ಮೀನಾ", "worker").first_name).toBe("ಮೀನಾ");
  });
});
