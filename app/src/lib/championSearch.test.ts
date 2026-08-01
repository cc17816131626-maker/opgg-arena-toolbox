import { describe, expect, it } from "vitest";
import { buildChampionSearchIndex, searchChampions } from "./championSearch";
import type { ChampionSummary } from "../types";

const sample: ChampionSummary[] = [
  {
    id: 157,
    key: "yasuo",
    name: "疾风剑豪",
    imageUrl: "https://example.com/yasuo.png",
    tier: 1,
    rank: 3,
    winRate: 52,
    pickRate: 10,
  },
  {
    id: 238,
    key: "zed",
    name: "影流之主",
    imageUrl: "https://example.com/zed.png",
    tier: 2,
    rank: 12,
    winRate: 50,
    pickRate: 8,
  },
];

describe("championSearch", () => {
  const index = buildChampionSearchIndex(sample);

  it("matches by English key", () => {
    expect(searchChampions(index, "yas").map((c) => c.key)).toContain("yasuo");
  });

  it("matches by Chinese proper name", () => {
    const keys = searchChampions(index, "亚索").map((c) => c.key);
    expect(keys).toContain("yasuo");
  });

  it("matches by pinyin", () => {
    const keys = searchChampions(index, "yasuo").map((c) => c.key);
    expect(keys).toContain("yasuo");
  });

  it("returns all when query empty", () => {
    expect(searchChampions(index, "  ").length).toBe(2);
  });
});
