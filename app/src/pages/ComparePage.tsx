import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDataStore } from "../store/dataStore";
import { EmptyState } from "../components/EmptyState";
import { ChampionAvatar } from "../components/ChampionAvatar";
import { TierBadge } from "../components/TierBadge";
import { buildChampionSearchIndex, getChampionProperName, searchChampions } from "../lib/championSearch";
import { pct, num } from "../lib/format";
import { CachedImage } from "../components/CachedImage";

const MAX_COMPARE = 3;

export function ComparePage() {
  const bundle = useDataStore((s) => s.bundle);
  const loading = useDataStore((s) => s.loading);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const champions = bundle?.champions ?? [];
  const searchIndex = useMemo(() => buildChampionSearchIndex(champions), [champions]);
  const candidates = useMemo(() => {
    return searchChampions(searchIndex, query)
      .filter((c) => !selected.includes(c.key))
      .slice(0, 12);
  }, [searchIndex, query, selected]);

  const selectedDetails = useMemo(() => {
    if (!bundle) return [];
    return selected
      .map((key) => {
        const summary = bundle.champions.find((c) => c.key === key);
        const detail = bundle.championDetails[key];
        return summary && detail ? { summary, detail } : null;
      })
      .filter(Boolean) as Array<{ summary: (typeof champions)[number]; detail: NonNullable<(typeof bundle)["championDetails"][string]> }>;
  }, [bundle, selected, champions]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-[var(--text-muted)]">正在加载数据…</div>;
  }
  if (!bundle) return <EmptyState />;

  function add(key: string) {
    setSelected((prev) => (prev.length >= MAX_COMPARE || prev.includes(key) ? prev : [...prev, key]));
    setQuery("");
  }

  function remove(key: string) {
    setSelected((prev) => prev.filter((k) => k !== key));
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">英雄对比</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">最多选择 {MAX_COMPARE} 名英雄，并排比较强度与出装</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {selectedDetails.map(({ summary }) => (
          <button
            key={summary.key}
            onClick={() => remove(summary.key)}
            className="flex items-center gap-2 rounded-lg bg-[var(--surface-1)] px-2.5 py-1.5 text-sm ring-1 ring-[var(--border)] hover:ring-rose-400/40"
            title="点击移除"
          >
            <ChampionAvatar src={summary.imageUrl} alt={summary.name} size={24} />
            {getChampionProperName(summary)}
            <span className="text-[var(--text-muted)]">×</span>
          </button>
        ))}
        {selected.length < MAX_COMPARE && (
          <div className="relative min-w-[220px] flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索并添加英雄…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm outline-none focus:border-indigo-400/50"
            />
            {query.trim() && candidates.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-xl">
                {candidates.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => add(c.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)]"
                  >
                    <ChampionAvatar src={c.imageUrl} alt={c.name} size={24} />
                    {getChampionProperName(c)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDetails.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">先添加至少一名英雄开始对比</div>
      ) : (
        <div className="grid flex-1 gap-4 overflow-y-auto pb-8" style={{ gridTemplateColumns: `repeat(${selectedDetails.length}, minmax(0, 1fr))` }}>
          {selectedDetails.map(({ summary, detail }) => (
            <div key={summary.key} className="rounded-xl bg-[var(--surface-1)] p-4 ring-1 ring-[var(--border)]">
              <button
                onClick={() => navigate(`/champions/${summary.key}`)}
                className="mb-3 flex w-full items-center gap-3 text-left hover:opacity-90"
              >
                <ChampionAvatar src={summary.imageUrl} alt={summary.name} size={48} className="rounded-xl" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{getChampionProperName(summary)}</span>
                    <TierBadge tier={summary.tier} size="sm" />
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">#{summary.rank}</div>
                </div>
              </button>

              <StatRow label="胜率" value={pct(detail.averageStats.winRate)} />
              <StatRow label="登场率" value={pct(detail.averageStats.pickRate)} />
              <StatRow label="禁用率" value={pct(detail.averageStats.banRate)} />
              <StatRow label="吃鸡率" value={pct(detail.averageStats.firstPlace)} />
              <StatRow label="平均名次" value={num(detail.averageStats.avgPlace)} />

              <div className="mt-4 text-xs font-medium text-[var(--text-muted)]">棱彩装备 Top3</div>
              <div className="mt-2 space-y-1.5">
                {detail.build.prismItems.slice(0, 3).map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {entry.items.map((it) => (
                      <CachedImage key={it.itemId} src={it.imageUrl} alt={it.name} title={it.name} className="h-7 w-7 rounded" />
                    ))}
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">{pct(entry.pickRate)}</span>
                  </div>
                ))}
                {detail.build.prismItems.length === 0 && <div className="text-xs text-[var(--text-muted)]">暂无</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] py-1.5 text-sm last:border-b-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
