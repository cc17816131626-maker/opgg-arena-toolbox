import * as cheerio from "cheerio";
import type { ItemBuildEntry, ItemRef } from "./types.js";

// cheerio 在不同版本间导出的节点类型（Element/AnyNode）不太稳定，
// 这里用 any 规避类型体操，只在这个内部小模块里这样处理。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioNode = any;

export interface ItemSection {
  caption: string;
  headers: string[];
  rows: CheerioNode[];
}

const HEADER_KEY_MAP: Record<string, keyof ItemBuildEntry | undefined> = {
  平均名次: "avgPlace",
  第一名: "firstPlaceRate",
  选用率: "pickRate",
  胜率: "winRate",
};

function stripCommas(s: string): string {
  return s.replace(/,/g, "");
}

function parseNumbers(text: string): number[] {
  const cleaned = stripCommas(text);
  const matches = cleaned.match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

/**
 * 把渲染出的「出装」相关表格（出门装/核心装备/鞋子/棱镜装备）解析成结构化条目。
 * 用 caption 文本之后紧跟的 thead + tbody 当一个逻辑分组，
 * 用表头文字（而不是写死列序号）去判断每一列代表的指标，更不容易因为站点细节调整而失效。
 */
export function parseItemSections($: cheerio.CheerioAPI, root: CheerioNode): ItemSection[] {
  const sections: ItemSection[] = [];
  let current: ItemSection | null = null;

  root.find("caption, thead, tbody").each((_: number, el: CheerioNode) => {
    const node = $(el);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();

    if (tag === "caption") {
      current = { caption: node.text().trim(), headers: [], rows: [] };
      sections.push(current);
      return;
    }
    if (!current) return;

    if (tag === "thead") {
      current.headers = node
        .find("th")
        .toArray()
        .map((th) => $(th).text().trim());
      return;
    }
    if (tag === "tbody") {
      current.rows = node
        .find("tr")
        .toArray()
        .map((tr) => $(tr));
    }
  });

  return sections;
}

export function rowsToItemEntries($: cheerio.CheerioAPI, section: ItemSection): ItemBuildEntry[] {
  const entries: ItemBuildEntry[] = [];

  for (const row of section.rows) {
    const tds = row.find("td").toArray().map((td: CheerioNode) => $(td));
    if (tds.length === 0) continue;

    // 第一列（装备名称列）里可能有多个 [data-meta-id] 包装的装备图标
    // （“核心装备”有时是一整条多件装备的出装路线，不止一件装备）。
    const items: ItemRef[] = tds[0]
      .find("[data-meta-id]")
      .toArray()
      .map((el: CheerioNode) => {
        const metaEl = $(el);
        const img = metaEl.find("img, span[src]").first();
        return {
          itemId: Number(metaEl.attr("data-meta-id")),
          name: img.attr("alt") ?? "",
          imageUrl: img.attr("src") ?? "",
        };
      });
    if (items.length === 0) continue; // “数据未找到” 占位行没有 meta 信息，跳过

    const entry: ItemBuildEntry = { items };

    for (let i = 1; i < tds.length; i++) {
      const headerText = section.headers[i] ?? "";
      const key = HEADER_KEY_MAP[headerText];
      if (!key) continue;
      const text = tds[i].text();
      const numbers = parseNumbers(text);
      if (numbers.length === 0) continue;

      if (key === "winRate") {
        entry.winRate = numbers[0];
        if (numbers.length > 1) entry.games = numbers[1];
      } else {
        (entry[key] as number | undefined) = numbers[0];
      }
    }

    entries.push(entry);
  }

  return entries;
}

export function findSectionByRowIdPrefix(sections: ItemSection[], prefix: string): ItemSection | undefined {
  return sections.find((s) => s.rows.some((r) => (r.attr("data-key") ?? "").startsWith(prefix)));
}
