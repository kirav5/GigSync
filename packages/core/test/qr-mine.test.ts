import type { MyQr, QrCode } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Collection, keepQr, keptQr, MemoryStorage, MY_QR_KEY, showMyQr } from "../src/index.js";

const qr = (code: string): MyQr => ({ code: code as QrCode, created_at: "2026-10-30T10:00:00+05:30" });
const OLD = qr("Qold00000000");
const NEW = qr("Qnew00000000");

describe("the owner's QR on this phone", () => {
  it("first open: nothing kept, so it shows the server's code once and keeps it", async () => {
    const storage = new MemoryStorage();
    const shown: MyQr[] = [];
    expect(
      await showMyQr(
        storage,
        async () => OLD,
        (q) => shown.push(q),
      ),
    ).toEqual(OLD);
    expect(shown).toEqual([OLD]);
    expect(await keptQr(storage)).toEqual(OLD);
  });

  it("a later open shows the kept code before the server answers, and not again when the code is the same", async () => {
    const storage = new MemoryStorage();
    await keepQr(storage, OLD);
    const shown: MyQr[] = [];
    let answer: (q: MyQr) => void = () => undefined;
    const pending = showMyQr(
      storage,
      () => new Promise<MyQr>((done) => (answer = done)),
      (q) => shown.push(q),
    );
    await expect.poll(() => shown.length).toBe(1);
    expect(shown).toEqual([OLD]);
    answer(OLD);
    await pending;
    expect(shown).toEqual([OLD]);
  });

  it("replaces the shown code when the server's differs, as after a new QR on another device", async () => {
    const storage = new MemoryStorage();
    await keepQr(storage, OLD);
    const shown: MyQr[] = [];
    await showMyQr(
      storage,
      async () => NEW,
      (q) => shown.push(q),
    );
    expect(shown).toEqual([OLD, NEW]);
    expect(await keptQr(storage)).toEqual(NEW);
  });

  it("offline: keeps showing the kept code; with nothing kept, the failure is the caller's", async () => {
    const kept = new MemoryStorage();
    await keepQr(kept, OLD);
    const offline = async (): Promise<MyQr> => {
      throw new Error("offline");
    };
    expect(await showMyQr(kept, offline, () => undefined)).toEqual(OLD);
    await expect(showMyQr(new MemoryStorage(), offline, () => undefined)).rejects.toThrow("offline");
  });

  it("ignores a kept record that is not a QR", async () => {
    const storage = new MemoryStorage();
    await storage.put(Collection.ownerSettings, MY_QR_KEY, { code: 7 });
    expect(await keptQr(storage)).toBeUndefined();
  });
});
