import { pinyin } from "pinyin-pro";
import type { ChampionSummary } from "../types";
import { CHAMPION_PROPER_NAME } from "../data/championNames";
import { CHAMPION_ALIASES } from "../data/championAliases";

export interface ChampionSearchEntry {
  champion: ChampionSummary;
  /** 英雄本名（比如「亚索」），OP.GG 的 name 字段其实是称号，展示时可以用它补充 */
  properName: string;
  /** 所有可以拿来模糊匹配的关键字：本名/称号/别名/key/拼音全拼/拼音首字母 */
  keywords: string[];
}

function toPinyin(text: string, pattern?: "first"): string {
  try {
    const parts = pinyin(text, { toneType: "none", type: "array", pattern });
    return parts.join("").toLowerCase();
  } catch {
    return "";
  }
}

/** 根据当前英雄列表构建一次搜索索引，之后每次输入只需要在这份索引上做字符串匹配 */
export function buildChampionSearchIndex(champions: ChampionSummary[]): ChampionSearchEntry[] {
  return champions.map((champion) => {
    const properName = CHAMPION_PROPER_NAME[champion.key] ?? "";
    const aliases = CHAMPION_ALIASES[champion.key] ?? [];
    const displayNames = [champion.name, properName, ...aliases].filter(Boolean);

    const keywords = new Set<string>();
    keywords.add(champion.key.toLowerCase());
    for (const displayName of displayNames) {
      keywords.add(displayName.toLowerCase());
      const full = toPinyin(displayName);
      const initials = toPinyin(displayName, "first");
      if (full) keywords.add(full);
      if (initials) keywords.add(initials);
    }

    return { champion, properName, keywords: Array.from(keywords) };
  });
}

export function searchChampions(index: ChampionSearchEntry[], rawQuery: string): ChampionSummary[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return index.map((entry) => entry.champion);
  return index.filter((entry) => entry.keywords.some((kw) => kw.includes(query))).map((entry) => entry.champion);
}

/** 拿英雄本名做展示：本名和称号同时展示（比如「亚索 · 疾风剑豪」），本名缺失时退回称号 */
export function getChampionProperName(champion: ChampionSummary): string {
  return CHAMPION_PROPER_NAME[champion.key] ?? champion.name;
}
