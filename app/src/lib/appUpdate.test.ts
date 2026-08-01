import { describe, expect, it } from "vitest";
import { compareSemver } from "./appUpdate";

describe("compareSemver", () => {
  it("orders versions", () => {
    expect(compareSemver("0.2.0", "0.1.0")).toBeGreaterThan(0);
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
    expect(compareSemver("0.1.0", "0.1.1")).toBeLessThan(0);
  });
});
