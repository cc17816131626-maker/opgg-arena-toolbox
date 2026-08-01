import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDataStore } from "../store/dataStore";
import { CachedImage } from "../components/CachedImage";
import { EmptyState } from "../components/EmptyState";
import { pct, compactInt } from "../lib/format";
import type { AugmentRarity } from "../types";

const RARITY_LABEL: Record<AugmentRarity, string> = {
  prismatic: "棱彩",
  gold: "金色",
  silver: "白银",
};

const RARITY_STYLE: Record<AugmentRarity, string> = {
  prismatic: "from-fuchsia-500/15 to-purple-500/5 ring-fuchsia-400/30 text-fuchsia-200",
  gold: "from-amber-500/15 to-yellow-500/5 ring-amber-400/30 text-amber-200",
  silver: "from-slate-400/15 to-slate-500/5 ring-slate-300/30 text-slate-200",
};

interface AggregatedAugment {
  id: number;
  name: string;
  rarity: AugmentRarity;
  imageUrl: string;
  description: string;
  totalGames: number;
  weightedPickRateSum: number;
  weightedWinRateSum: number;
  winRateGames: number;
  championCount: number;
}

function useAggregatedAugments() {
  const bundle = useDataStore((s) => s.bundle);

  return useMemo(() => {
    const map = new Map<number, AggregatedAugment>();
    if (!bundle) return [] as AggregatedAugment[];

    for (const detail of Object.values(bundle.championDetails)) {
      for (const rarity of ["silver", "gold", "prismatic"] as AugmentRarity[]) {
        for (const aug of detail.augmentsByRarity[rarity]) {
          const existing = map.get(aug.id);
          if (existing) {
            existing.totalGames += aug.games;
            existing.weightedPickRateSum += aug.pickRate * aug.games;
            if (aug.winRate != null) {
              existing.weightedWinRateSum += aug.winRate * aug.games;
              existing.winRateGames += aug.games;
            }
            existing.championCount += 1;
          } else {
            map.set(aug.id, {
              id: aug.id,
              name: aug.name,
              rarity: aug.rarity,
              imageUrl: aug.imageUrl,
              description: aug.description,
              totalGames: aug.games,
              weightedPickRateSum: aug.pickRate * aug.games,
              weightedWinRateSum: aug.winRate != null ? aug.winRate * aug.games : 0,
              winRateGames: aug.winRate != null ? aug.games : 0,
              championCount: 1,
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalGames - a.totalGames);
  }, [bundle]);
}

export function AugmentsPage() {
  const augments = useAggregatedAugments();
  const loading = useDataStore((s) => s.loading);
  const bundle = useDataStore((s) => s.bundle);
  const [rarityFilter, setRarityFilter] = useState<AugmentRarity | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return augments.filter((a) => {
      if (rarityFilter !== "all" && a.rarity !== rarityFilter) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [augments, rarityFilter, search]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-zinc-500">正在加载数据…</div>;
  }

  if (!bundle) {
    return <EmptyState description="加载数据后即可查看全英雄强化符文汇总" />;
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">强化符文榜</h1>
          <p className="mt-1 text-sm text-zinc-500">按全英雄选用数据汇总 · 共 {augments.length} 个强化符文</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索强化符文…"
          className="w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-indigo-400/50"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "prismatic", "gold", "silver"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRarityFilter(r)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
              rarityFilter === r
                ? "bg-indigo-500/20 text-indigo-200 ring-indigo-400/40"
                : "bg-white/[0.02] text-zinc-400 ring-white/10 hover:text-zinc-200"
            }`}
          >
            {r === "all" ? "全部" : RARITY_LABEL[r]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">未找到匹配的强化符文</div>
      )}

      <div className="grid grid-cols-1 gap-3 overflow-y-auto pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={`rounded-xl bg-gradient-to-br p-3.5 ring-1 ${RARITY_STYLE[a.rarity]}`}
            >
              <div className="flex items-start gap-3">
                <CachedImage
                  src={a.imageUrl}
                  alt={a.name}
                  className="h-12 w-12 rounded-lg ring-1 ring-white/10"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{a.name}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{RARITY_LABEL[a.rarity]}</div>
                </div>
              </div>
              {a.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">{a.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-zinc-400">
                  选用率 <span className="font-medium text-zinc-100">{pct(a.weightedPickRateSum / a.totalGames)}</span>
                  {a.winRateGames > 0 && (
                    <>
                      {" · "}胜率{" "}
                      <span className="font-medium text-indigo-300">{pct(a.weightedWinRateSum / a.winRateGames)}</span>
                    </>
                  )}
                </span>
                <span className="text-zinc-500">{compactInt(a.totalGames)} 场</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
