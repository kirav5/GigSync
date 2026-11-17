import { describe, expect, it } from "vitest";
import { codePage, consentPage } from "../src/pages.js";

/** The sign-in pages show values that came from a client or a person: they must never become markup. */
describe("sign-in pages", () => {
  it("escapes a client's self-chosen name and host on the consent page", () => {
    const html = consentPage(
      { clientName: `<script>alert(1)</script>`, redirectHost: `evil"><img>`, redirectIsLoopback: true, scope: [] },
      "h1",
    );
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain(`"><img>`);
    expect(html).toContain("app on this computer");
  });

  it("escapes the number on the code page and keeps plain words plain", () => {
    const html = codePage(`+91<b>`);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&#60;b&#62;");
    expect(html).toContain("<title>Enter your code</title>");
  });
});
