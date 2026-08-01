import { readFile } from "node:fs/promises";
import type { ArenaDataBundle } from "./types.js";

export interface DiffReport {
  previousPatch: string | null;
  nextPatch: string;
  championCountDelta: number;
  addedChampions: string[];
  removedChampions: string[];
  tierMovers: Array<{ key: string; name: string; from: number; to: number }>;
  rankMovers: Array<{ key: string; name: string; from: number; to: number; delta: number }>;
}

export async function loadPreviousBundle(jsonPath: string): Promise<ArenaDataBundle | null> {
  try {
    const raw = await readFile(jsonPath, "utf8");
    return JSON.parse(raw) as ArenaDataBundle;
  } catch {
    return null;
  }
}

export function buildDiffReport(previous: ArenaDataBundle | null, next: ArenaDataBundle): DiffReport {
  if (!previous) {
    return {
      previousPatch: null,
      nextPatch: next.patch,
      championCountDelta: next.champions.length,
      addedChampions: next.champions.map((c) => c.key),
      removedChampions: [],
      tierMovers: [],
      rankMovers: [],
    };
  }

  const prevMap = new Map(previous.champions.map((c) => [c.key, c]));
  const nextMap = new Map(next.champions.map((c) => [c.key, c]));

  const addedChampions = next.champions.filter((c) => !prevMap.has(c.key)).map((c) => c.key);
  const removedChampions = previous.champions.filter((c) => !nextMap.has(c.key)).map((c) => c.key);

  const tierMovers: DiffReport["tierMovers"] = [];
  const rankMovers: DiffReport["rankMovers"] = [];

  for (const c of next.champions) {
    const prev = prevMap.get(c.key);
    if (!prev) continue;
    if (prev.tier !== c.tier) {
      tierMovers.push({ key: c.key, name: c.name, from: prev.tier, to: c.tier });
    }
    if (prev.rank !== c.rank) {
      rankMovers.push({
        key: c.key,
        name: c.name,
        from: prev.rank,
        to: c.rank,
        delta: prev.rank - c.rank, // 正数 = 排名上升
      });
    }
  }

  tierMovers.sort((a, b) => a.to - b.to || a.from - b.from);
  rankMovers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    previousPatch: previous.patch,
    nextPatch: next.patch,
    championCountDelta: next.champions.length - previous.champions.length,
    addedChampions,
    removedChampions,
    tierMovers,
    rankMovers: rankMovers.slice(0, 20),
  };
}

export function formatDiffReport(report: DiffReport): string {
  const lines: string[] = [];
  lines.push(
    report.previousPatch
      ? `补丁 ${report.previousPatch} → ${report.nextPatch}（英雄数 Δ${report.championCountDelta >= 0 ? "+" : ""}${report.championCountDelta}）`
      : `首次抓取，补丁 ${report.nextPatch}，英雄 ${report.championCountDelta} 名`,
  );

  if (report.addedChampions.length) {
    lines.push(`新增英雄：${report.addedChampions.join(", ")}`);
  }
  if (report.removedChampions.length) {
    lines.push(`移除英雄：${report.removedChampions.join(", ")}`);
  }
  if (report.tierMovers.length) {
    const sample = report.tierMovers
      .slice(0, 12)
      .map((m) => `${m.name} T${m.from}→T${m.to}`)
      .join("；");
    lines.push(`段位变动 ${report.tierMovers.length} 名：${sample}${report.tierMovers.length > 12 ? "…" : ""}`);
  }
  if (report.rankMovers.length) {
    const sample = report.rankMovers
      .slice(0, 8)
      .map((m) => `${m.name} #${m.from}→#${m.to} (${m.delta >= 0 ? "+" : ""}${m.delta})`)
      .join("；");
    lines.push(`排名变动 Top：${sample}`);
  }
  if (
    report.previousPatch &&
    !report.addedChampions.length &&
    !report.removedChampions.length &&
    !report.tierMovers.length
  ) {
    lines.push("段位结构无变化（排名可能有微调）");
  }
  return lines.join("\n");
}
