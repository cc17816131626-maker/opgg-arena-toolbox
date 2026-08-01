import { describe, expect, it } from "vitest";
import { collectImageUrls } from "./gameData";
import type { ArenaDataBundle } from "../types";

const bundle = {
  schemaVersion: 1 as const,
  patch: "16.15.1",
  generatedAt: "2026-08-01T00:00:00Z",
  champions: [
    {
      id: 1,
      key: "ahri",
      name: "九尾妖狐",
      imageUrl: "https://cdn.example.com/ahri.png",
      tier: 1,
      rank: 1,
      winRate: 50,
      pickRate: 10,
    },
  ],
  championDetails: {
    ahri: {
      id: 1,
      key: "ahri",
      name: "九尾妖狐",
      imageUrl: "https://cdn.example.com/ahri.png",
      tier: 1,
      rank: 1,
      averageStats: { winRate: 50, pickRate: 10, banRate: 5, firstPlace: 12, avgPlace: 4.2 },
      augmentsByRarity: {
        silver: [
          {
            id: 9,
            name: "test",
            rarity: "silver" as const,
            imageUrl: "https://cdn.example.com/aug.png",
            pickRate: 1,
            games: 10,
            description: "",
          },
        ],
        gold: [],
        prismatic: [],
      },
      skillMasteries: [],
      duoSynergies: [],
      trioCombinations: [],
      build: {
        starterItems: [],
        boots: [],
        coreBuilds: [],
        prismItems: [],
        finalItems: [],
      },
    },
  },
} satisfies ArenaDataBundle;

describe("collectImageUrls", () => {
  it("collects imageUrl fields recursively", () => {
    const urls = collectImageUrls(bundle);
    expect(urls).toContain("https://cdn.example.com/ahri.png");
    expect(urls).toContain("https://cdn.example.com/aug.png");
    expect(urls.length).toBe(2);
  });
});
