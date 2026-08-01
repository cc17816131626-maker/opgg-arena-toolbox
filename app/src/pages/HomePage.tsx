import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useDataStore } from "../store/dataStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { ChampionAvatar } from "../components/ChampionAvatar";
import { TierBadge } from "../components/TierBadge";
import { buildChampionSearchIndex, getChampionProperName, searchChampions } from "../lib/championSearch";
import { EmptyState } from "../components/EmptyState";
import { zh } from "../i18n/zh";
import type { ChampionSummary } from "../types";

export function HomePage() {
  const bundle = useDataStore((s) => s.bundle);
  const loading = useDataStore((s) => s.loading);
  const favoriteKeys = useFavoritesStore((s) => s.keys);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const champions = bundle?.champions ?? [];
  const searchIndex = useMemo(() => buildChampionSearchIndex(champions), [champions]);

  const favorites = useMemo(() => {
    const map = new Map(champions.map((c) => [c.key, c]));
    return favoriteKeys.map((k) => map.get(k)).filter(Boolean) as ChampionSummary[];
  }, [champions, favoriteKeys]);

  const filtered = useMemo(() => {
    const matched = searchChampions(searchIndex, search);
    return [...matched].sort((a, b) => getChampionProperName(a).localeCompare(getChampionProperName(b), "zh-CN"));
  }, [searchIndex, search]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-[var(--text-muted)]">正在加载数据…</div>;
  }

  if (!bundle) {
    return <EmptyState title={zh.empty.title} description={zh.empty.description} actionLabel={zh.empty.action} />;
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">全部英雄</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            补丁 {bundle.patch} · 共 {champions.length} 位英雄 · 点击头像查看详情
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索英雄名 / 拼音…"
          className="w-64 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-indigo-400/50"
        />
      </div>

      {!search.trim() && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{zh.favorites.title}</h2>
          {favorites.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">{zh.favorites.empty}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {favorites.map((champion) => (
                <button
                  key={champion.key}
                  onClick={() => navigate(`/champions/${champion.key}`)}
                  className="flex items-center gap-2 rounded-lg bg-[var(--surface-1)] px-2.5 py-1.5 ring-1 ring-[var(--border)] hover:ring-indigo-400/40"
                >
                  <ChampionAvatar src={champion.imageUrl} alt={champion.name} size={28} />
                  <span className="text-sm">{getChampionProperName(champion)}</span>
                  <TierBadge tier={champion.tier} size="sm" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">未找到匹配的英雄</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3 overflow-y-auto pb-6">
          {filtered.map((champion, idx) => (
            <motion.button
              key={champion.key}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.16, delay: Math.min(idx, 40) * 0.006 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/champions/${champion.key}`)}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-[var(--surface-hover)]"
            >
              <div className="relative">
                <ChampionAvatar
                  src={champion.imageUrl}
                  alt={champion.name}
                  size={64}
                  className="rounded-2xl transition-shadow group-hover:ring-2 group-hover:ring-indigo-400/50"
                />
                <span className="absolute -bottom-1 -right-1">
                  <TierBadge tier={champion.tier} size="sm" />
                </span>
                {favoriteKeys.includes(champion.key) && (
                  <span className="absolute -left-1 -top-1 text-xs text-amber-400">★</span>
                )}
              </div>
              <span className="w-full truncate text-xs font-medium">{getChampionProperName(champion)}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
