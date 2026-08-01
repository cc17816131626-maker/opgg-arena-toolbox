import { describe, expect, it } from "vitest";
import { compactInt, num, pct } from "./format";

describe("format", () => {
  it("pct formats percentage", () => {
    expect(pct(12.345)).toBe("12.3%");
    expect(pct(undefined)).toBe("-");
  });

  it("num formats decimals", () => {
    expect(num(3.14159)).toBe("3.14");
    expect(num(NaN)).toBe("-");
  });

  it("compactInt formats integers", () => {
    expect(compactInt(1234)).toBe("1,234");
    expect(compactInt(undefined)).toBe("-");
  });
});
