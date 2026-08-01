import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useDataStore } from "../store/dataStore";
import { TierBadge } from "../components/TierBadge";
import { ChampionAvatar } from "../components/ChampionAvatar";
import { pct, num } from "../lib/format";
import { buildChampionSearchIndex, getChampionProperName, searchChampions } from "../lib/championSearch";
import { EmptyState } from "../components/EmptyState";
import type { ChampionSummary, ChampionDetail } from "../types";

type SortKey = "rank" | "winRate" | "pickRate" | "banRate" | "firstPlace" | "avgPlace" | "tier";

const SORT_LABEL: Record<SortKey, string> = {
  rank: "排名",
  tier: "Tier",
  winRate: "胜率",
  pickRate: "登场率",
  banRate: "禁用率",
  firstPlace: "吃鸡率",
  avgPlace: "平均名次",
};

interface Row extends ChampionSummary {
  detail?: ChampionDetail;
}

export function TierListPage() {
  const bundle = useDataStore((s) => s.bundle);
  const loading = useDataStore((s) => s.loading);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rows: Row[] = useMemo(() => {
    if (!bundle) return [];
    return bundle.champions.map((c) => ({ ...c, detail: bundle.championDetails[c.key] }));
  }, [bundle]);

  const searchIndex = useMemo(() => buildChampionSearchIndex(rows), [rows]);

  const filtered = useMemo(() => {
    const matchedKeys = new Set(searchChampions(searchIndex, search).map((c) => c.key));
    let list = search.trim() ? rows.filter((r) => matchedKeys.has(r.key)) : rows;

    list = [...list].sort((a, b) => {
      const getVal = (r: Row): number => {
        switch (sortKey) {
          case "rank":
            return r.rank;
          case "tier":
            return r.tier;
          case "winRate":
            return r.winRate;
          case "pickRate":
            return r.pickRate;
          case "banRate":
            return r.detail?.averageStats.banRate ?? -1;
          case "firstPlace":
            return r.detail?.averageStats.firstPlace ?? -1;
          case "avgPlace":
            return r.detail?.averageStats.avgPlace ?? 999;
        }
      };
      return (getVal(a) - getVal(b)) * sortDir;
    });
    return list;
  }, [rows, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "avgPlace" || key === "rank" ? 1 : -1);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        正在加载数据…
      </div>
    );
  }

  if (!bundle) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">英雄强度榜</h1>
          <p className="mt-1 text-sm text-zinc-500">补丁 {bundle.patch} · 共 {rows.length} 位英雄</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索英雄…"
          className="w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:border-indigo-400/50"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
        <div className="grid grid-cols-[64px_1fr_72px_100px_100px_100px_100px_110px] items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-zinc-500">
          <HeaderCell label="排名" sortKey="rank" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <div>英雄</div>
          <HeaderCell label="Tier" sortKey="tier" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="胜率" sortKey="winRate" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="登场率" sortKey="pickRate" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="禁用率" sortKey="banRate" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="吃鸡率" sortKey="firstPlace" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="平均名次" sortKey="avgPlace" active={sortKey} dir={sortDir} onClick={toggleSort} />
        </div>

        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-zinc-500">未找到匹配的英雄</div>
          )}
          {filtered.map((row, idx) => (
            <motion.div
              key={row.key}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(idx, 20) * 0.01 }}
              whileHover={{ backgroundColor: "rgba(255,255,255,0.035)" }}
              onClick={() => navigate(`/champions/${row.key}`)}
              className="grid grid-cols-[64px_1fr_72px_100px_100px_100px_100px_110px] cursor-pointer items-center gap-2 border-b border-white/[0.03] px-4 py-2.5 text-sm last:border-b-0"
            >
              <div className="font-mono text-zinc-500">#{row.rank}</div>
              <div className="flex items-center gap-3">
                <ChampionAvatar src={row.imageUrl} alt={row.name} size={32} />
                <div className="flex flex-col leading-tight">
                  <span className="font-medium">{getChampionProperName(row)}</span>
                  <span className="text-[11px] text-zinc-500">{row.name}</span>
                </div>
              </div>
              <div>
                <TierBadge tier={row.tier} size="sm" />
              </div>
              <div className="text-zinc-300">{pct(row.winRate)}</div>
              <div className="text-zinc-300">{pct(row.pickRate)}</div>
              <div className="text-zinc-400">{row.detail ? pct(row.detail.averageStats.banRate) : "-"}</div>
              <div className="text-zinc-400">{row.detail ? pct(row.detail.averageStats.firstPlace) : "-"}</div>
              <div className="text-zinc-400">{row.detail ? num(row.detail.averageStats.avgPlace) : "-"}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  label,
  sortKey,
  active,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: 1 | -1;
  onClick: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 text-left transition-colors hover:text-zinc-200 ${isActive ? "text-indigo-300" : ""}`}
      title={SORT_LABEL[sortKey]}
    >
      {label}
      {isActive && <span className="text-[10px]">{dir === 1 ? "▲" : "▼"}</span>}
    </button>
  );
}
