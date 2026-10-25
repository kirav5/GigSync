import { describe, expect, it } from "vitest";
import { Payment, PaymentRequest, UPI_MAX_PAISE, Utr, Vpa } from "../src/index.js";

const ULID = "01J0000000000000000000AAAA";
const request = {
  id: `pay_${ULID}`,
  engagement: `eng_${ULID}`,
  payee: `usr_${ULID}`,
  payer: `usr_${ULID}`,
  amount_paise: 45_000,
  note: "Cleaning, 3 visits",
  payee_vpa: "sita.devi@okaxis",
  payee_name: "Sita Devi",
  requested_at: "2026-10-25T18:00:00+05:30",
};

describe("payments", () => {
  it("accepts common UPI IDs and rejects malformed ones", () => {
    for (const ok of ["sita@okaxis", "9876543210@ybl", "a.b-c_d@paytm"]) expect(Vpa.safeParse(ok).success).toBe(true);
    for (const bad of ["sita", "@okaxis", "sita@", "si ta@okaxis", "sita@1bank"])
      expect(Vpa.safeParse(bad).success).toBe(false);
  });
  it("accepts a payment request", () => {
    expect(PaymentRequest.parse(request).amount_paise).toBe(45_000);
  });
  it("rejects fractional, zero and over-limit amounts", () => {
    for (const amount_paise of [450.5, 0, UPI_MAX_PAISE + 1])
      expect(PaymentRequest.safeParse({ ...request, amount_paise }).success).toBe(false);
  });
  it("UTR is exactly 12 digits", () => {
    expect(Utr.safeParse("412345678901").success).toBe(true);
    expect(Utr.safeParse("41234567890").success).toBe(false);
  });
  it("a payment record carries no UPI ID", () => {
    const { payee_vpa: _v, payee_name: _n, ...rest } = request;
    const payment = Payment.parse({ ...rest, method: "upi", status: "requested" });
    expect(Object.keys(payment)).not.toContain("payee_vpa");
  });
});
