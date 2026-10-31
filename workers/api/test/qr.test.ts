import { HttpError, HttpMethod } from "@gigsync/core";
import { QR_LOOKUPS_PER_HOUR, QrCode } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { card, household, householdWithCode, listedWorker, worker } from "./qr-helpers.js";
import { sql } from "./sql.js";

const NO_SUCH_CODE = "AAAAAAAAAAAA";

describe("my QR code", () => {
  it("is made once, kept, and shows the name the owner gives now", async () => {
    const p = await signIn("+919866600001");
    const first = await p.api.myQr(household("Priya"));
    expect(QrCode.safeParse(first.code).success).toBe(true);
    const again = await p.api.myQr(household("Priya S"));
    expect(again).toEqual(first);
    const other = await signIn("+919866600002");
    expect(await other.api.lookupQr(first.code)).toEqual({
      role: "household",
      user: p.session.user,
      first_name: "Priya S",
    });
  });

  it("is replaced by a new one, and the old one finds nobody", async () => {
    const { home, code } = await householdWithCode("+919866600003", "Lakshmi");
    const next = await home.api.replaceQr(household("Lakshmi"));
    expect(next.code).not.toBe(code);
    expect((await home.api.myQr(household("Lakshmi"))).code).toBe(next.code);
    const scanner = await signIn("+919866600004");
    await expect(scanner.api.lookupQr(code)).rejects.toMatchObject({ status: 404 });
    expect((await scanner.api.lookupQr(next.code)).user).toBe(home.session.user);
  });

  it("shows a worker's board card, or no card before they list", async () => {
    const w = await signIn("+919866600005");
    const { code } = await w.api.myQr(worker("Meena"));
    const scanner = await signIn("+919866600006");
    expect(await scanner.api.lookupQr(code)).toEqual({
      role: "worker",
      user: w.session.user,
      first_name: "Meena",
      card: null,
    });
    await w.api.publishProfile(card("Meena K", ["cook", "maid"]));
    expect(await scanner.api.lookupQr(code)).toMatchObject({
      card: { display_name: "Meena K", trades: ["cook", "maid"] },
    });
  });

  it("never shows a phone number", async () => {
    const listed = await listedWorker("+919866600007", "Ravi");
    const { code } = await listed.api.myQr(worker("Ravi"));
    const found = await (await signIn("+919866600008")).api.lookupQr(code);
    expect(JSON.stringify(found)).not.toContain("9866600007");
  });

  it("refuses bad bodies and bad codes", async () => {
    const p = await signIn("+919866600009");
    expect((await call(p, HttpMethod.put, "/qr/me", { role: "household", first_name: "" })).status).toBe(400);
    expect((await call(p, HttpMethod.put, "/qr/me", { role: "boss", first_name: "A" })).status).toBe(400);
    expect((await call(p, HttpMethod.post, "/qr/me/replace", "nope")).status).toBe(400);
    expect((await call(p, HttpMethod.get, "/qr/short")).status).toBe(400);
    await expect(p.api.lookupQr(NO_SUCH_CODE)).rejects.toMatchObject({ status: 404 });
  });

  it("needs a session for every route", async () => {
    expect((await call(undefined, HttpMethod.put, "/qr/me", household("A"))).status).toBe(401);
    expect((await call(undefined, HttpMethod.post, "/qr/me/replace", household("A"))).status).toBe(401);
    expect((await call(undefined, HttpMethod.get, `/qr/${NO_SUCH_CODE}`)).status).toBe(401);
    expect((await call(undefined, HttpMethod.post, `/qr/${NO_SUCH_CODE}/offer`)).status).toBe(401);
  });

  it("caps lookups per person per hour, found or not, and counts again after the hour", async () => {
    const p = await signIn("+919866600010");
    for (let i = 0; i < QR_LOOKUPS_PER_HOUR; i++)
      await expect(p.api.lookupQr(NO_SUCH_CODE)).rejects.toMatchObject({ status: 404 });
    const capped = await p.api.lookupQr(NO_SUCH_CODE).catch((err: unknown) => err);
    expect(capped).toBeInstanceOf(HttpError);
    expect((capped as HttpError).status).toBe(429);
    // Someone else still looks up freely.
    await expect((await signIn("+919866600011")).api.lookupQr(NO_SUCH_CODE)).rejects.toMatchObject({ status: 404 });
    await sql("UPDATE qr_lookups SET window_start = now() - interval '2 hours' WHERE user_id = $1", [p.session.user]);
    await expect(p.api.lookupQr(NO_SUCH_CODE)).rejects.toMatchObject({ status: 404 });
  });

  it("finds nobody once the owner's account is frozen", async () => {
    const { home, code } = await householdWithCode("+919866600012", "Asha");
    await sql("UPDATE users SET status = 'frozen' WHERE user_id = $1", [home.session.user]);
    await expect((await signIn("+919866600013")).api.lookupQr(code)).rejects.toMatchObject({ status: 404 });
  });
});
