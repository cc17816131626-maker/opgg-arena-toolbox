import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDataStore } from "../store/dataStore";
import { TierBadge } from "../components/TierBadge";
import { ChampionAvatar } from "../components/ChampionAvatar";
import { CachedImage } from "../components/CachedImage";
import { getChampionProperName } from "../lib/championSearch";
import { CHAMPION_PROPER_NAME } from "../data/championNames";
import { pct, num, compactInt } from "../lib/format";
import type { AugmentRarity, ItemBuildEntry } from "../types";

type TabKey = "build" | "skills" | "augments" | "synergies";

const TABS: { key: TabKey; label: string }[] = [
  { key: "build", label: "出装" },
  { key: "synergies", label: "英雄协同" },
  { key: "augments", label: "增幅装置" },
  { key: "skills", label: "技能" },
];

export function ChampionDetailPage() {
  const { championKey = "" } = useParams();
  const navigate = useNavigate();
  const bundle = useDataStore((s) => s.bundle);
  const [tab, setTab] = useState<TabKey>("build");

  const summary = useMemo(() => bundle?.champions.find((c) => c.key === championKey), [bundle, championKey]);
  const detail = bundle?.championDetails[championKey];

  if (!bundle) return null;

  if (!summary || !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
        <div>未找到该英雄的数据</div>
        <button onClick={() => navigate("/")} className="text-sm text-indigo-300 hover:underline">
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-8 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 w-fit text-sm text-zinc-500 hover:text-zinc-200">
        ← 返回
      </button>

      <div className="mb-6 flex items-center gap-4">
        <ChampionAvatar src={summary.imageUrl} alt={summary.name} size={64} className="rounded-2xl" />
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold">{getChampionProperName(summary)}</h1>
            <span className="text-base text-zinc-400">{summary.name}</span>
            <TierBadge tier={summary.tier} />
            <span className="text-sm text-zinc-500">#{summary.rank}</span>
          </div>
          <div className="mt-1.5 flex gap-4 text-sm text-zinc-400">
            <span>平均名次 <b className="text-zinc-200">{num(detail.averageStats.avgPlace)}</b></span>
            <span>第一名 <b className="text-zinc-200">{pct(detail.averageStats.firstPlace)}</b></span>
            <span>胜率 <b className="text-indigo-300">{pct(detail.averageStats.winRate)}</b></span>
            <span>选用率 <b className="text-zinc-200">{pct(detail.averageStats.pickRate)}</b></span>
            <span>禁用率 <b className="text-zinc-200">{pct(detail.averageStats.banRate)}</b></span>
          </div>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <motion.div layoutId="champion-tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-indigo-400" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
          >
            {tab === "build" && <BuildTab build={detail.build} />}
            {tab === "skills" && <SkillsTab masteries={detail.skillMasteries} />}
            {tab === "augments" && <AugmentsTab byRarity={detail.augmentsByRarity} />}
            {tab === "synergies" && <SynergiesTab detail={detail} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-zinc-300">{title}</h3>
      {children}
    </div>
  );
}

function ItemRow({ entry }: { entry: ItemBuildEntry }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2 ring-1 ring-white/5">
      <div className="flex gap-1.5">
        {entry.items.map((it) => (
          <CachedImage
            key={it.itemId}
            src={it.imageUrl}
            alt={it.name}
            title={it.name}
            className="h-9 w-9 rounded-md ring-1 ring-white/10"
          />
        ))}
      </div>
      <div className="ml-auto flex gap-4 text-xs text-zinc-400">
        {entry.avgPlace != null && (
          <span>
            平均名次 <b className="text-zinc-200">{num(entry.avgPlace)}</b>
          </span>
        )}
        {entry.firstPlaceRate != null && (
          <span>
            第一名 <b className="text-zinc-200">{pct(entry.firstPlaceRate)}</b>
          </span>
        )}
        {entry.pickRate != null && (
          <span>
            选用率 <b className="text-zinc-200">{pct(entry.pickRate)}</b>
            {entry.games != null && <span className="ml-1 text-zinc-600">{compactInt(entry.games)} 场</span>}
          </span>
        )}
        {entry.winRate != null && (
          <span>
            胜率 <b className="text-indigo-300">{pct(entry.winRate)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

function BuildTab({ build }: { build: import("../types").ChampionBuild }) {
  // 斗魂竞技场里所有人起始装备固定，OP.GG「出门装」通常为空，不展示该分组。
  const groups: { title: string; entries: ItemBuildEntry[] }[] = [
    { title: "鞋子", entries: build.boots },
    { title: "棱彩装备", entries: build.prismItems },
    { title: "核心装备", entries: build.coreBuilds },
    { title: "最终出装", entries: build.finalItems ?? [] },
  ];
  return (
    <div>
      {groups.map((g) => (
        <Section key={g.title} title={`${g.title}${g.entries.length ? ` · ${g.entries.length}` : ""}`}>
          {g.entries.length === 0 ? (
            <div className="text-sm text-zinc-600">暂无数据</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.entries.map((e, i) => (
                <ItemRow key={i} entry={e} />
              ))}
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}

const SKILL_STYLE: Record<string, string> = {
  Q: "bg-sky-500/20 text-sky-200 ring-sky-400/40",
  W: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
  E: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
  R: "bg-rose-500/20 text-rose-200 ring-rose-400/40",
};

function SkillBadge({ skill, size = "md" }: { skill: string; size?: "sm" | "md" }) {
  const key = skill.toUpperCase();
  const style = SKILL_STYLE[key] ?? "bg-white/10 text-zinc-200 ring-white/20";
  const dim = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-md font-mono font-bold ring-1 ${style}`}
      title={key}
    >
      {key}
    </span>
  );
}

function SkillOrder({ order, separator }: { order: string[]; separator: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {order.map((skill, i) => (
        <span key={`${skill}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="px-0.5 text-[10px] text-zinc-600">{separator}</span>}
          <SkillBadge skill={skill} size={order.length > 6 ? "sm" : "md"} />
        </span>
      ))}
    </div>
  );
}

function SkillsTab({ masteries }: { masteries: import("../types").SkillMastery[] }) {
  if (masteries.length === 0) return <div className="text-sm text-zinc-600">暂无数据</div>;
  return (
    <div className="space-y-4">
      {masteries.map((m, i) => (
        <div key={i} className="rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/5">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <SkillOrder order={m.priorityOrder} separator=">" />
            <span className="ml-auto text-xs text-zinc-500">
              {compactInt(m.play)} 场 · 选用率 {pct(m.pickRate)} · 吃鸡率 {pct(m.firstPlace)}
            </span>
          </div>
          <div className="space-y-2">
            {m.builds.map((b, j) => (
              <div key={j} className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <SkillOrder order={b.order} separator="→" />
                <span className="ml-auto shrink-0">
                  选用率 {pct(b.pickRate)} · 胜率 <b className="text-indigo-300">{pct(b.winRate)}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const RARITY_LABEL: Record<AugmentRarity, string> = { prismatic: "棱彩", gold: "金色", silver: "白银" };

function AugmentsTab({ byRarity }: { byRarity: Record<AugmentRarity, import("../types").AugmentEntry[]> }) {
  return (
    <div className="space-y-6">
      {(["prismatic", "gold", "silver"] as AugmentRarity[]).map((rarity) => (
        <Section key={rarity} title={RARITY_LABEL[rarity]}>
          {byRarity[rarity].length === 0 ? (
            <div className="text-sm text-zinc-600">暂无数据</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byRarity[rarity].map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-3 py-2 ring-1 ring-white/5">
                  <CachedImage
                    src={a.imageUrl}
                    alt={a.name}
                    className="h-9 w-9 rounded-md ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-200">{a.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      选用率 <b className="text-zinc-300">{pct(a.pickRate)}</b>
                      {a.winRate != null && (
                        <>
                          {" · "}胜率 <b className="text-indigo-300">{pct(a.winRate)}</b>
                        </>
                      )}
                      {" · "}
                      {compactInt(a.games)} 场
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}

function SynergyMetrics({
  avgPlace,
  firstPlace,
  pickRate,
  winRate,
  games,
}: {
  avgPlace: number;
  firstPlace: number;
  pickRate: number;
  winRate: number;
  games: number;
}) {
  return (
    <div className="ml-auto flex items-center gap-4 text-xs text-zinc-400">
      <span className="w-12 text-right">
        平均名次 <b className="text-zinc-200">{num(avgPlace)}</b>
      </span>
      <span className="w-14 text-right">
        第一名 <b className="text-zinc-200">{pct(firstPlace)}</b>
      </span>
      <span className="w-20 text-right">
        选用率 <b className="text-zinc-200">{pct(pickRate)}</b>
        <span className="ml-1 text-zinc-600">{compactInt(games)} 场</span>
      </span>
      <span className="w-14 text-right">
        胜率 <b className="text-indigo-300">{pct(winRate)}</b>
      </span>
    </div>
  );
}

/** 兼容旧数据包里未 remap 的 snake_case image_url */
function comboChampionImageUrl(tc: { imageUrl?: string; image_url?: string }): string {
  return tc.imageUrl || tc.image_url || "";
}

function SynergiesTab({ detail }: { detail: import("../types").ChampionDetail }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"trio" | "duo">(detail.trioCombinations.length > 0 ? "trio" : "duo");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">推荐队伍组合</h3>
        <div className="flex rounded-lg bg-white/5 p-0.5 text-xs ring-1 ring-white/10">
          {(["trio", "duo"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                mode === m ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m === "trio" ? "队伍" : "双人"}
            </button>
          ))}
        </div>
      </div>

      {mode === "trio" ? (
        detail.trioCombinations.length === 0 ? (
          <div className="text-sm text-zinc-600">暂无数据</div>
        ) : (
          <div className="space-y-2">
            {detail.trioCombinations.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ring-white/5">
                <div className="flex items-center gap-1.5">
                  {c.teammateChampions.map((tc, idx) => (
                    <div key={tc.id} className="flex items-center gap-1.5">
                      {idx > 0 && <span className="text-zinc-600">+</span>}
                      <button
                        type="button"
                        onClick={() => navigate(`/champions/${tc.key}`)}
                        className="flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.06]"
                        title={`查看 ${CHAMPION_PROPER_NAME[tc.key] ?? tc.name}`}
                      >
                        <ChampionAvatar src={comboChampionImageUrl(tc)} alt={tc.name} size={30} />
                        <span className="text-sm text-zinc-200 hover:text-indigo-200">
                          {CHAMPION_PROPER_NAME[tc.key] ?? tc.name}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                <SynergyMetrics
                  avgPlace={c.averagePlace}
                  firstPlace={c.firstPlaceRate}
                  pickRate={c.pickRate}
                  winRate={c.winRate}
                  games={c.play}
                />
              </div>
            ))}
          </div>
        )
      ) : detail.duoSynergies.length === 0 ? (
        <div className="text-sm text-zinc-600">暂无数据</div>
      ) : (
        <div className="space-y-2">
          {detail.duoSynergies.map((s) => (
            <div key={s.championId} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ring-white/5">
              <button
                type="button"
                onClick={() => navigate(`/champions/${s.championKey}`)}
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.06]"
                title={`查看 ${CHAMPION_PROPER_NAME[s.championKey] ?? s.championName}`}
              >
                <ChampionAvatar src={s.championImageUrl} alt={s.championName} size={30} />
                <span className="text-sm text-zinc-200 hover:text-indigo-200">
                  {CHAMPION_PROPER_NAME[s.championKey] ?? s.championName}
                </span>
              </button>
              <SynergyMetrics
                avgPlace={s.avgPlace}
                firstPlace={s.firstPlace}
                pickRate={s.pickRate}
                winRate={s.winRate}
                games={s.play}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
