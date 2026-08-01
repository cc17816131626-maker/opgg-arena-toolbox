import { create } from "zustand";
import type { ChampionSummary } from "../types";

export interface PatchSnapshot {
  patch: string;
  version: string;
  capturedAt: string;
  champions: Array<Pick<ChampionSummary, "key" | "name" | "tier" | "rank" | "winRate" | "pickRate">>;
}

export interface RankDelta {
  key: string;
  name: string;
  fromRank: number;
  toRank: number;
  delta: number;
  fromTier: number;
  toTier: number;
}

interface PatchHistoryState {
  previous: PatchSnapshot | null;
  current: PatchSnapshot | null;
  load: () => void;
  /** 数据加载成功后调用：若补丁变化则把旧 current 挪到 previous */
  recordBundle: (input: {
    patch: string;
    version: string;
    champions: ChampionSummary[];
  }) => void;
  getRankDeltas: () => RankDelta[];
}

const STORAGE_KEY = "arena-patch-history-v1";

function toSnapshot(input: {
  patch: string;
  version: string;
  champions: ChampionSummary[];
}): PatchSnapshot {
  return {
    patch: input.patch,
    version: input.version,
    capturedAt: new Date().toISOString(),
    champions: input.champions.map((c) => ({
      key: c.key,
      name: c.name,
      tier: c.tier,
      rank: c.rank,
      winRate: c.winRate,
      pickRate: c.pickRate,
    })),
  };
}

export const usePatchHistoryStore = create<PatchHistoryState>((set, get) => ({
  previous: null,
  current: null,

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { previous: PatchSnapshot | null; current: PatchSnapshot | null };
      set({ previous: parsed.previous ?? null, current: parsed.current ?? null });
    } catch {
      /* ignore */
    }
  },

  recordBundle: (input) => {
    const { current, previous } = get();
    let nextPrevious = previous;
    let nextCurrent = current;

    if (!current) {
      nextCurrent = toSnapshot(input);
    } else if (current.patch !== input.patch || current.version !== input.version) {
      nextPrevious = current;
      nextCurrent = toSnapshot(input);
    } else {
      // 同版本刷新时更新快照数字
      nextCurrent = toSnapshot(input);
    }

    const payload = { previous: nextPrevious, current: nextCurrent };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    set(payload);
  },

  getRankDeltas: () => {
    const { previous, current } = get();
    if (!previous || !current) return [];
    const prevMap = new Map(previous.champions.map((c) => [c.key, c]));
    const deltas: RankDelta[] = [];
    for (const c of current.champions) {
      const p = prevMap.get(c.key);
      if (!p || p.rank === c.rank) continue;
      deltas.push({
        key: c.key,
        name: c.name,
        fromRank: p.rank,
        toRank: c.rank,
        delta: p.rank - c.rank,
        fromTier: p.tier,
        toTier: c.tier,
      });
    }
    return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  },
}));
