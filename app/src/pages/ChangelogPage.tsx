import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDataStore } from "../store/dataStore";
import { usePatchHistoryStore } from "../store/patchHistoryStore";
import { EmptyState } from "../components/EmptyState";
import { ChampionAvatar } from "../components/ChampionAvatar";
import { getChampionProperName } from "../lib/championSearch";
import { CHAMPION_PROPER_NAME } from "../data/championNames";

export function ChangelogPage() {
  const bundle = useDataStore((s) => s.bundle);
  const manifest = useDataStore((s) => s.manifest);
  const loading = useDataStore((s) => s.loading);
  const navigate = useNavigate();
  const previous = usePatchHistoryStore((s) => s.previous);
  const current = usePatchHistoryStore((s) => s.current);
  const loadHistory = usePatchHistoryStore((s) => s.load);
  const getRankDeltas = usePatchHistoryStore((s) => s.getRankDeltas);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const deltas = useMemo(() => getRankDeltas().slice(0, 40), [getRankDeltas, previous, current]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-[var(--text-muted)]">正在加载数据…</div>;
  }
  if (!bundle) return <EmptyState />;

  const championMap = new Map(bundle.champions.map((c) => [c.key, c]));

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-8 py-6">
      <h1 className="mb-1 text-xl font-bold">版本变更</h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        当前补丁 <b className="text-[var(--text-primary)]">{bundle.patch}</b>
        {manifest ? ` · 数据 ${manifest.version}` : ""}
        {previous ? ` · 对比上一份本地快照 ${previous.patch}` : " · 再更新一次数据后即可看到跨版本排名变动"}
      </p>

      <section className="mb-6 rounded-xl bg-[var(--surface-1)] p-4 ring-1 ring-[var(--border)]">
        <h2 className="mb-2 text-sm font-semibold">数据来源</h2>
        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
          <li>
            数据包 Release：
            <a
              className="ml-1 text-indigo-400 hover:underline"
              href="https://github.com/cc17816131626-maker/opgg-arena-toolbox/releases"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Releases
            </a>
          </li>
          <li>本地会在补丁/版本变化时自动留存上一份排名快照，用于本页对比。</li>
        </ul>
      </section>

      {!previous || deltas.length === 0 ? (
        <div className="rounded-xl bg-[var(--surface-1)] px-4 py-10 text-center text-sm text-[var(--text-muted)] ring-1 ring-[var(--border)]">
          {previous
            ? "两次快照之间排名没有变化"
            : "暂无历史快照。下次通过设置页更新数据（补丁或版本变化）后，这里会显示强度变动榜。"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]">
          <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text-muted)]">
            <div>英雄</div>
            <div>原排名</div>
            <div>现排名</div>
            <div>变化</div>
          </div>
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {deltas.map((d) => {
              const champ = championMap.get(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => navigate(`/champions/${d.key}`)}
                  className="grid w-full grid-cols-[1fr_100px_100px_80px] items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex items-center gap-2">
                    {champ && <ChampionAvatar src={champ.imageUrl} alt={champ.name} size={28} />}
                    <span>{CHAMPION_PROPER_NAME[d.key] ?? (champ ? getChampionProperName(champ) : d.name)}</span>
                    {d.fromTier !== d.toTier && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        T{d.fromTier}→T{d.toTier}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-muted)]">#{d.fromRank}</div>
                  <div>#{d.toRank}</div>
                  <div className={d.delta > 0 ? "text-emerald-400" : "text-rose-400"}>
                    {d.delta > 0 ? `↑${d.delta}` : `↓${Math.abs(d.delta)}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
