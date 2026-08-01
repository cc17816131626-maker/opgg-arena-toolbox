import { describe, expect, it } from "vitest";
import { getPollIntervalMs, shouldCheckNow, shouldCheckOnLaunch } from "./autoUpdate";
import type { AppSettings } from "../types";

const base: AppSettings = {
  autoUpdate: true,
  updateFrequency: "onLaunch",
  lastCheckedAt: null,
};

describe("autoUpdate", () => {
  it("checks on launch when enabled", () => {
    expect(shouldCheckOnLaunch(base)).toBe(true);
    expect(shouldCheckOnLaunch({ ...base, updateFrequency: "manual" })).toBe(false);
    expect(shouldCheckOnLaunch({ ...base, autoUpdate: false })).toBe(false);
  });

  it("respects every6Hours window", () => {
    const recent: AppSettings = {
      autoUpdate: true,
      updateFrequency: "every6Hours",
      lastCheckedAt: new Date().toISOString(),
    };
    expect(shouldCheckNow(recent)).toBe(false);
    expect(shouldCheckOnLaunch(recent)).toBe(false);

    const stale: AppSettings = {
      ...recent,
      lastCheckedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    };
    expect(shouldCheckNow(stale)).toBe(true);
  });

  it("returns poll interval for timed modes only", () => {
    expect(getPollIntervalMs("manual")).toBeNull();
    expect(getPollIntervalMs("onLaunch")).toBeNull();
    expect(getPollIntervalMs("every6Hours")).toBe(10 * 60 * 1000);
  });
});
