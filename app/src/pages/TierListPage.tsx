import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
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

const ROW_GRID = "grid-cols-[64px_1fr_72px_100px_100px_100px_100px_110px]";
const ROW_HEIGHT = 48;

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
  const parentRef = useRef<HTMLDivElement>(null);

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
          default: {
            const _exhaustive: never = sortKey;
            return _exhaustive;
          }
        }
      };
      return (getVal(a) - getVal(b)) * sortDir;
    });
    return list;
  }, [rows, search, sortKey, sortDir, searchIndex]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "avgPlace" || key === "rank" ? 1 : -1);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-[var(--text-muted)]">正在加载数据…</div>;
  }

  if (!bundle) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">英雄强度榜</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            补丁 {bundle.patch} · 共 {rows.length} 位英雄
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索英雄…"
          className="w-64 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-indigo-400/50"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)]">
        <div className={`grid ${ROW_GRID} items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs font-medium text-[var(--text-muted)]`}>
          <HeaderCell label="排名" sortKey="rank" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <div>英雄</div>
          <HeaderCell label="Tier" sortKey="tier" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="胜率" sortKey="winRate" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="登场率" sortKey="pickRate" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="禁用率" sortKey="banRate" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="吃鸡率" sortKey="firstPlace" active={sortKey} dir={sortDir} onClick={toggleSort} />
          <HeaderCell label="平均名次" sortKey="avgPlace" active={sortKey} dir={sortDir} onClick={toggleSort} />
        </div>

        <div ref={parentRef} className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">未找到匹配的英雄</div>
          ) : (
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = filtered[virtualRow.index];
                return (
                  <div
                    key={row.key}
                    onClick={() => navigate(`/champions/${row.key}`)}
                    className={`absolute left-0 top-0 grid w-full ${ROW_GRID} cursor-pointer items-center gap-2 border-b border-[var(--border)] px-4 text-sm hover:bg-[var(--surface-hover)]`}
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="font-mono text-[var(--text-muted)]">#{row.rank}</div>
                    <div className="flex items-center gap-3">
                      <ChampionAvatar src={row.imageUrl} alt={row.name} size={32} />
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium">{getChampionProperName(row)}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">{row.name}</span>
                      </div>
                    </div>
                    <div>
                      <TierBadge tier={row.tier} size="sm" />
                    </div>
                    <div>{pct(row.winRate)}</div>
                    <div>{pct(row.pickRate)}</div>
                    <div className="text-[var(--text-muted)]">{row.detail ? pct(row.detail.averageStats.banRate) : "-"}</div>
                    <div className="text-[var(--text-muted)]">{row.detail ? pct(row.detail.averageStats.firstPlace) : "-"}</div>
                    <div className="text-[var(--text-muted)]">{row.detail ? num(row.detail.averageStats.avgPlace) : "-"}</div>
                  </div>
                );
              })}
            </div>
          )}
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
      className={`flex items-center gap-1 text-left transition-colors hover:text-[var(--text-primary)] ${isActive ? "text-indigo-400" : ""}`}
      title={SORT_LABEL[sortKey]}
    >
      {label}
      {isActive && <span className="text-[10px]">{dir === 1 ? "▲" : "▼"}</span>}
    </button>
  );
}
