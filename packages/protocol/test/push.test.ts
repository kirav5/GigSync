import { describe, expect, it } from "vitest";
import { FCM_TOKEN_MAX, isNativePush, NativePush, PushAddress } from "../src/index.js";

/** A token as Firebase hands them out: an id, a colon, then the token proper. */
const TOKEN =
  "dQw4w9WgXcQ:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv3hVZjC9KtT8OvPVGJ-hQMRKRrZuJAEcl7B338qju59zJMjw2DELjzEvxwYv7hH5Ynpc1ODQ0aT4U4OFEeco8ohsN5PjL1iC2dNtk2BAokeMCg2ZXKqpc8FXKmhX94kIxQ";

describe("NativePush", () => {
  it("takes an FCM token and the language its alert is worded in", () => {
    expect(NativePush.safeParse({ fcm: TOKEN, lang: "hi" }).success).toBe(true);
  });

  it("refuses an empty, over-long or odd token, and a language the app does not speak", () => {
    for (const fcm of ["", "a".repeat(FCM_TOKEN_MAX + 1), "has spaces in it", "x<script>"])
      expect(NativePush.safeParse({ fcm, lang: "en" }).success).toBe(false);
    expect(NativePush.safeParse({ fcm: TOKEN, lang: "fr" }).success).toBe(false);
    expect(NativePush.safeParse({ fcm: TOKEN }).success).toBe(false);
  });
});

describe("PushAddress", () => {
  it("is a browser's subscription or the Android app's token, and says which", () => {
    const web = PushAddress.parse({ endpoint: "https://fcm.googleapis.com/fcm/send/abc123" });
    const native = PushAddress.parse({ fcm: TOKEN, lang: "kn" });
    expect(isNativePush(web)).toBe(false);
    expect(isNativePush(native)).toBe(true);
  });

  it("refuses an address on a push service of anyone's choosing", () => {
    expect(PushAddress.safeParse({ endpoint: "https://evil.example/push" }).success).toBe(false);
  });
});
