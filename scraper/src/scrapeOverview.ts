import { parseFlightChunks } from "./flight/parse.js";
import { resolveAll } from "./flight/resolve.js";
import { deepFind, isArrayOfObjectsWithKeys } from "./flight/find.js";
import { fetchHtml } from "./http.js";
import type { ChampionSummary } from "./types.js";

export const ARENA_OVERVIEW_URL = "https://op.gg/zh-cn/lol/modes/arena";

export interface OverviewResult {
  champions: ChampionSummary[];
  patch: string;
}

export function extractPatchFromText(text: string): string {
  const m = /\/meta\/images\/lol\/(\d+\.\d+(?:\.\d+)?)\//.exec(text);
  if (!m) throw new Error("无法从页面数据中解析出版本号 (patch)");
  return m[1];
}

export async function fetchResolvedChunks(html: string) {
  const raw = parseFlightChunks(html);
  return resolveAll(raw);
}

export async function scrapeOverview(): Promise<OverviewResult> {
  const html = await fetchHtml(ARENA_OVERVIEW_URL);
  const resolved = await fetchResolvedChunks(html);

  const championsNode = deepFind(
    resolved.values(),
    (node) => !!node && typeof node === "object" && !Array.isArray(node) && isArrayOfObjectsWithKeys((node as Record<string, unknown>).champions, ["key", "win_rate", "pick_rate", "tier", "rank"])
  ) as { champions: Record<string, unknown>[] } | undefined;

  if (!championsNode) {
    throw new Error("在总览页数据中没有找到英雄强度榜（champions 数组），页面结构可能已变化");
  }

  const champions: ChampionSummary[] = championsNode.champions.map((c) => ({
    id: c.id as number,
    key: c.key as string,
    name: c.name as string,
    imageUrl: c.image_url as string,
    tier: c.tier as number,
    rank: c.rank as number,
    winRate: round2((c.win_rate as number) * 100),
    pickRate: round2((c.pick_rate as number) * 100),
  }));

  const patch = extractPatchFromText(champions[0]?.imageUrl ?? html);

  return { champions, patch };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
