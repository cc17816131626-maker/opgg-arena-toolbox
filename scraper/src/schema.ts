import { z } from "zod";
import type { ArenaDataBundle } from "./types.js";

const AverageStatsSchema = z.object({
  winRate: z.number(),
  pickRate: z.number(),
  banRate: z.number(),
  firstPlace: z.number(),
  avgPlace: z.number(),
});

const AugmentEntrySchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  rarity: z.enum(["silver", "gold", "prismatic"]),
  imageUrl: z.string(),
  pickRate: z.number(),
  winRate: z.number().optional(),
  games: z.number(),
  description: z.string(),
});

const ItemRefSchema = z.object({
  itemId: z.number(),
  name: z.string().min(1),
  imageUrl: z.string(),
});

const ItemBuildEntrySchema = z.object({
  items: z.array(ItemRefSchema).min(1),
  avgPlace: z.number().optional(),
  firstPlaceRate: z.number().optional(),
  pickRate: z.number().optional(),
  winRate: z.number().optional(),
  games: z.number().optional(),
});

const ChampionBuildSchema = z.object({
  starterItems: z.array(ItemBuildEntrySchema),
  boots: z.array(ItemBuildEntrySchema),
  coreBuilds: z.array(ItemBuildEntrySchema),
  prismItems: z.array(ItemBuildEntrySchema),
  finalItems: z.array(ItemBuildEntrySchema),
});

const SkillBuildSchema = z.object({
  order: z.array(z.string()),
  play: z.number(),
  pickRate: z.number(),
  winRate: z.number(),
});

const SkillMasterySchema = z.object({
  priorityOrder: z.array(z.string()),
  play: z.number(),
  firstPlace: z.number(),
  pickRate: z.number(),
  builds: z.array(SkillBuildSchema),
});

const SynergyChampionSchema = z.object({
  championId: z.number(),
  championKey: z.string().min(1),
  championName: z.string().min(1),
  championImageUrl: z.string(),
  opRank: z.number(),
  play: z.number(),
  win: z.number(),
  winRate: z.number(),
  firstPlace: z.number(),
  pickRate: z.number(),
  avgPlace: z.number(),
});

const ArenaCombinationChampionSchema = z.object({
  id: z.number(),
  key: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string(),
});

const ArenaCombinationSchema = z.object({
  championIds: z.array(z.number()),
  teammateChampionIds: z.array(z.number()),
  champions: z.array(ArenaCombinationChampionSchema),
  teammateChampions: z.array(ArenaCombinationChampionSchema),
  arenaFormat: z.string(),
  combinationSize: z.number(),
  play: z.number(),
  win: z.number(),
  winRate: z.number(),
  firstPlaceRate: z.number(),
  averagePlace: z.number(),
  pickRate: z.number(),
});

const ChampionSummarySchema = z.object({
  id: z.number(),
  key: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string(),
  tier: z.number(),
  rank: z.number(),
  winRate: z.number(),
  pickRate: z.number(),
});

const ChampionDetailSchema = z.object({
  id: z.number(),
  key: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string(),
  tier: z.number(),
  rank: z.number(),
  averageStats: AverageStatsSchema,
  augmentsByRarity: z.object({
    silver: z.array(AugmentEntrySchema),
    gold: z.array(AugmentEntrySchema),
    prismatic: z.array(AugmentEntrySchema),
  }),
  skillMasteries: z.array(SkillMasterySchema),
  duoSynergies: z.array(SynergyChampionSchema),
  trioCombinations: z.array(ArenaCombinationSchema),
  build: ChampionBuildSchema,
});

export const ArenaDataBundleSchema = z.object({
  schemaVersion: z.literal(1),
  patch: z.string().min(1),
  generatedAt: z.string().min(1),
  champions: z.array(ChampionSummarySchema).min(1),
  championDetails: z.record(z.string(), ChampionDetailSchema),
});

export function validateBundle(bundle: ArenaDataBundle): ArenaDataBundle {
  const parsed = ArenaDataBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const more = parsed.error.issues.length > 12 ? `\n  …共 ${parsed.error.issues.length} 个问题` : "";
    throw new Error(`数据包 schema 校验失败：\n${issues}${more}`);
  }

  // 业务一致性：每个 summary 都必须有对应 detail
  const missing = bundle.champions.filter((c) => !bundle.championDetails[c.key]).map((c) => c.key);
  if (missing.length > 0) {
    throw new Error(`以下英雄缺少详情数据：${missing.slice(0, 20).join(", ")}${missing.length > 20 ? "…" : ""}`);
  }

  return parsed.data as ArenaDataBundle;
}
