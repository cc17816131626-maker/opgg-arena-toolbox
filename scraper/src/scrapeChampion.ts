import * as cheerio from "cheerio";
import { parseFlightChunks } from "./flight/parse.js";
import { resolveAll } from "./flight/resolve.js";
import { deepFind, hasKeys } from "./flight/find.js";
import { renderChunksToHtml } from "./flight/render.js";
import { fetchHtml, sleep } from "./http.js";
import { findSectionByRowIdPrefix, parseItemSections, rowsToItemEntries } from "./itemTable.js";
import type {
  ArenaCombination,
  AugmentEntry,
  AugmentRarity,
  AverageStats,
  ChampionBuild,
  ChampionDetail,
  ChampionSummary,
  ItemBuildEntry,
  SkillMastery,
  SynergyChampion,
} from "./types.js";

const ARENA_BASE = "https://op.gg/zh-cn/lol/modes/arena";

const RARITY_LABEL: Record<string, AugmentRarity> = {
  "1": "silver",
  "4": "gold",
  "8": "prismatic",
};

export interface ScrapeChampionOptions {
  /** 每次请求之间的等待时间（毫秒），用于控制抓取速率 */
  delayMs?: number;
}

async function fetchResolved(url: string) {
  const html = await fetchHtml(url);
  const raw = parseFlightChunks(html);
  return resolveAll(raw);
}

function extractAverageStatsAndSynergies(resolved: Map<string, unknown>) {
  const node = deepFind(resolved.values(), (n) => hasKeys(n, ["synergies", "champion"]) && hasKeys((n as Record<string, unknown>).champion, ["average_stats"])) as
    | {
        champion: { average_stats: Record<string, number> };
        synergies: Record<string, unknown>[];
        arenaCombinations?: Record<string, unknown>[];
      }
    | undefined;

  if (!node) {
    throw new Error("没有找到英雄概览数据块 (average_stats/synergies)，页面结构可能已变化");
  }

  const stats = node.champion.average_stats;
  const averageStats: AverageStats = {
    winRate: stats.win_rate,
    pickRate: stats.pick_rate,
    banRate: stats.ban_rate,
    firstPlace: stats.first_place,
    avgPlace: stats.avg_place,
  };

  const duoSynergies: SynergyChampion[] = node.synergies.map((s) => ({
    championId: s.champion_id as number,
    championKey: s.champion_key as string,
    championName: s.champion_name as string,
    championImageUrl: s.champion_image_url as string,
    opRank: s.op_rank as number,
    play: Number(String(s.play).replace(/,/g, "")),
    win: s.win as number,
    winRate: s.win_rate as number,
    firstPlace: s.first_place as number,
    pickRate: s.pick_rate as number,
    avgPlace: s.avg_place as number,
  }));

  const mapComboChamp = (raw: Record<string, unknown>): ArenaCombination["champions"][number] => ({
    id: raw.id as number,
    key: (raw.key as string) ?? "",
    name: (raw.name as string) ?? "",
    // OP.GG Flight 用 snake_case；统一成前端的 camelCase
    imageUrl: (raw.imageUrl as string) ?? (raw.image_url as string) ?? "",
  });

  const trioCombinations: ArenaCombination[] = (node.arenaCombinations ?? []).map((c) => {
    const rec = c as Record<string, unknown>;
    const champions = ((rec.champions as Record<string, unknown>[]) ?? []).map(mapComboChamp);
    const teammateChampions = ((rec.teammate_champions as Record<string, unknown>[]) ?? []).map(mapComboChamp);
    return {
      championIds: rec.champion_ids as number[],
      teammateChampionIds: rec.teammate_champion_ids as number[],
      champions,
      teammateChampions,
      arenaFormat: rec.arena_format as string,
      combinationSize: rec.combination_size as number,
      play: Number(String(rec.play).replace(/,/g, "")),
      win: rec.win as number,
      winRate: rec.win_rate as number,
      firstPlaceRate: (rec.first_place_rate ?? rec.first_place) as number,
      averagePlace: (rec.average_place ?? rec.avg_place) as number,
      pickRate: rec.pick_rate as number,
    };
  });

  return { averageStats, duoSynergies, trioCombinations };
}

function extractAugments(resolved: Map<string, unknown>): ChampionDetail["augmentsByRarity"] {
  const node = deepFind(resolved.values(), (n) => {
    if (!n || typeof n !== "object" || Array.isArray(n)) return false;
    const rec = n as Record<string, unknown>;
    const rarityKeys = Object.keys(rec).filter((k) => ["1", "4", "8"].includes(k));
    if (rarityKeys.length === 0) return false;
    return rarityKeys.every((k) => Array.isArray(rec[k]) && (rec[k] as unknown[]).every((item) => hasKeys(item, ["rareity", "pick_rate"])));
  }) as Record<string, Record<string, unknown>[]> | undefined;

  const result: ChampionDetail["augmentsByRarity"] = { silver: [], gold: [], prismatic: [] };
  if (!node) return result; // 个别英雄可能暂无强化符文数据，留空即可

  for (const [rarityKey, list] of Object.entries(node)) {
    const rarity = RARITY_LABEL[rarityKey];
    if (!rarity) continue;
    const entries: AugmentEntry[] = list.map((a) => ({
      id: a.id as number,
      name: a.name as string,
      rarity,
      imageUrl: a.image_url as string,
      pickRate: a.pick_rate as number,
      // OP.GG 增幅页返回的 win_rate 已经是 0~100 的百分比
      winRate: typeof a.win_rate === "number" ? a.win_rate : undefined,
      games: Number(String(a.play).replace(/,/g, "")),
      description: (a.desc as string) ?? "",
    }));
    result[rarity] = entries;
  }
  return result;
}

function extractSkillMasteries(resolved: Map<string, unknown>): SkillMastery[] {
  const node = deepFind(resolved.values(), (n) => hasKeys(n, ["skill_masteries"])) as
    | { skill_masteries: Record<string, unknown>[] }
    | undefined;
  if (!node) return [];

  return node.skill_masteries.map((m) => {
    const play = Number(String(m.play).replace(/,/g, ""));
    // 与站点其它榜单不同，加点榜的 pick_rate/win_rate 返回的是 0~1 的小数，
    // first_place 返回的是吃鸡场次的原始计数（不是比率）。这里统一换算成
    // 0~100 的百分比，和 averageStats / build 等字段保持同一量级，方便前端直接拼 "%"。
    const firstPlaceCount = Number(m.first_place);
    return {
      priorityOrder: m.ids as string[],
      play,
      firstPlace: play > 0 ? (firstPlaceCount / play) * 100 : 0,
      pickRate: (m.pick_rate as number) * 100,
      builds: (m.builds as Record<string, unknown>[]).map((b) => ({
        order: b.order as string[],
        play: Number(String(b.play).replace(/,/g, "")),
        pickRate: (b.pick_rate as number) * 100,
        winRate: (b.win_rate as number) * 100,
      })),
    };
  });
}

/** /items 页里每一组装备表格在 Flight 数据中是 `{ title, data: [...] }` 结构 */
interface StructuredItemSection {
  title: string;
  data: Record<string, unknown>[];
}

function collectStructuredItemSections(resolved: Map<string, unknown>): Map<string, StructuredItemSection> {
  const best = new Map<string, StructuredItemSection>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const rec = node as Record<string, unknown>;
    if (typeof rec.title === "string" && Array.isArray(rec.data)) {
      const section: StructuredItemSection = {
        title: rec.title,
        data: rec.data as Record<string, unknown>[],
      };
      const prev = best.get(section.title);
      if (!prev || section.data.length > prev.data.length) {
        best.set(section.title, section);
      }
    }
    for (const value of Object.values(rec)) visit(value);
  };

  for (const value of resolved.values()) visit(value);
  return best;
}

function numField(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function structuredRowsToEntries(rows: Record<string, unknown>[]): ItemBuildEntry[] {
  const entries: ItemBuildEntry[] = [];

  for (const row of rows) {
    const metaBuildItems = row.metaBuildItems as Array<{ id: number; name: string; image_url: string }> | undefined;
    const metaItem = row.metaItem as { id: number; name: string; image_url: string } | undefined;

    let items: ItemBuildEntry["items"] = [];
    if (Array.isArray(metaBuildItems) && metaBuildItems.length > 0) {
      items = metaBuildItems.map((it) => ({
        itemId: it.id,
        name: it.name,
        imageUrl: it.image_url,
      }));
    } else if (metaItem) {
      items = [
        {
          itemId: metaItem.id,
          name: metaItem.name,
          imageUrl: metaItem.image_url,
        },
      ];
    }
    if (items.length === 0) continue;

    entries.push({
      items,
      avgPlace: numField(row.avg_place),
      firstPlaceRate: numField(row.first_place),
      pickRate: numField(row.pick_rate),
      winRate: numField(row.win_rate),
      games: numField(row.play),
    });
  }

  return entries;
}

/**
 * 优先从 /items 页的结构化 `{title,data}` 抽取完整装备榜
 * （棱彩约 10 条、核心套装约 15 条、鞋子约 7 条、最终出装约 30 条）。
 * /build 页 HTML 表格通常只渲染前几名，作为兜底。
 */
function extractBuildFromItemsPage(resolved: Map<string, unknown>): ChampionBuild {
  const sections = collectStructuredItemSections(resolved);
  const pick = (title: string) => {
    const section = sections.get(title);
    return section ? structuredRowsToEntries(section.data) : [];
  };

  return {
    boots: pick("鞋子"),
    starterItems: pick("出门装"),
    prismItems: pick("棱镜装备"),
    coreBuilds: pick("核心装备"),
    finalItems: pick("最终出装"),
  };
}

function extractBuildFromBuildPageHtml(resolved: Map<string, unknown>): ChampionBuild {
  const html = renderChunksToHtml(resolved.values());
  // caption/thead/tbody 在标准 HTML 解析规则下必须挂在 <table> 下才合法，
  // 否则会被解析器“foster parenting”挪走；这里用 xmlMode 当成普通标签树解析，
  // 跳过那些表格语义校验。
  const $ = cheerio.load(html, { xmlMode: true });
  const root = $("#flight-root");
  const sections = parseItemSections($, root);

  const core = findSectionByRowIdPrefix(sections, "core_items_");
  const boots = findSectionByRowIdPrefix(sections, "boots_");
  const prism = findSectionByRowIdPrefix(sections, "prism_items_");
  const starter = findSectionByRowIdPrefix(sections, "starter_items_");

  return {
    coreBuilds: core ? rowsToItemEntries($, core) : [],
    boots: boots ? rowsToItemEntries($, boots) : [],
    prismItems: prism ? rowsToItemEntries($, prism) : [],
    starterItems: starter ? rowsToItemEntries($, starter) : [],
    finalItems: [],
  };
}

function mergeBuild(primary: ChampionBuild, fallback: ChampionBuild): ChampionBuild {
  return {
    boots: primary.boots.length > 0 ? primary.boots : fallback.boots,
    starterItems: primary.starterItems.length > 0 ? primary.starterItems : fallback.starterItems,
    prismItems: primary.prismItems.length > 0 ? primary.prismItems : fallback.prismItems,
    coreBuilds: primary.coreBuilds.length > 0 ? primary.coreBuilds : fallback.coreBuilds,
    finalItems: primary.finalItems.length > 0 ? primary.finalItems : fallback.finalItems,
  };
}

export async function scrapeChampion(summary: ChampionSummary, opts: ScrapeChampionOptions = {}): Promise<ChampionDetail> {
  const { delayMs = 800 } = opts;
  const base = `${ARENA_BASE}/${summary.key}`;

  const overviewResolved = await fetchResolved(base);
  await sleep(delayMs);
  const augmentsResolved = await fetchResolved(`${base}/augments`);
  await sleep(delayMs);
  const skillsResolved = await fetchResolved(`${base}/skills`);
  await sleep(delayMs);
  // /items 页有完整的鞋子/棱彩/核心套装/最终出装结构化数据；/build 页表格只渲染前几名，用作兜底
  const itemsResolved = await fetchResolved(`${base}/items`);
  await sleep(delayMs);
  const buildResolved = await fetchResolved(`${base}/build`);

  const { averageStats, duoSynergies, trioCombinations } = extractAverageStatsAndSynergies(overviewResolved);
  const augmentsByRarity = extractAugments(augmentsResolved);
  const skillMasteries = extractSkillMasteries(skillsResolved);
  const build = mergeBuild(extractBuildFromItemsPage(itemsResolved), extractBuildFromBuildPageHtml(buildResolved));

  return {
    id: summary.id,
    key: summary.key,
    name: summary.name,
    imageUrl: summary.imageUrl,
    tier: summary.tier,
    rank: summary.rank,
    averageStats,
    augmentsByRarity,
    skillMasteries,
    duoSynergies,
    trioCombinations,
    build,
  };
}
