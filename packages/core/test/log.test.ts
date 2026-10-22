import { afterEach, describe, expect, it, vi } from "vitest";
import { configureLog, log, pii, traced } from "../src/log.js";

function capture() {
  const lines: string[] = [];
  for (const m of ["debug", "log", "warn", "error"] as const) {
    vi.spyOn(console, m).mockImplementation((line: string) => void lines.push(line));
  }
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
  configureLog({});
});

describe("log", () => {
  it("redacts private values outside local", () => {
    const lines = capture();
    configureLog({ ENVIRONMENT: "pilot", LOG_LEVEL: "info" });
    log.info("signed in", { user: "usr_1", phone: pii("+919876543210") });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      level: "info",
      msg: "signed in",
      user: "usr_1",
      phone: "[redacted]",
    });
  });

  it("refuses LOG_PII anywhere but local", () => {
    const lines = capture();
    configureLog({ ENVIRONMENT: "production", LOG_PII: "true" });
    log.warn("x", { text: pii("find a house near Electronic City") });
    expect(lines[0]).not.toContain("Electronic City");
  });

  it("shows private values locally when asked", () => {
    const lines = capture();
    configureLog({ ENVIRONMENT: "local", LOG_LEVEL: "debug", LOG_PII: "true" });
    log.debug("chat: input", { text: pii("hello") });
    expect(JSON.parse(lines[0] ?? "").text).toBe("hello");
  });

  it("drops lines below the level, and an unknown level means info", () => {
    const lines = capture();
    configureLog({ ENVIRONMENT: "local", LOG_LEVEL: "loud" });
    log.debug("hidden");
    log.info("shown");
    expect(lines).toHaveLength(1);
  });

  it("traces calls at debug, and only then", async () => {
    const lines = capture();
    const add = traced("add", async (a: number, b: number) => a + b);
    configureLog({ ENVIRONMENT: "local", LOG_LEVEL: "info" });
    expect(await add(1, 2)).toBe(3);
    expect(lines).toHaveLength(0);

    configureLog({ ENVIRONMENT: "local", LOG_LEVEL: "debug", LOG_PII: "true" });
    await add(2, 3);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ msg: "add", args: [2, 3], result: 5 });
  });

  it("logs a failed call and rethrows", async () => {
    const lines = capture();
    configureLog({ ENVIRONMENT: "local", LOG_LEVEL: "debug" });
    const boom = traced("boom", async () => {
      throw new Error("nope");
    });
    await expect(boom()).rejects.toThrow("nope");
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ msg: "boom failed", error: { name: "Error", message: "nope" } });
  });
});
