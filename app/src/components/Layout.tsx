import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataStore } from "../store/dataStore";
import { useSettingsStore } from "../store/settingsStore";
import { ChampionAvatar } from "./ChampionAvatar";
import { buildChampionSearchIndex, getChampionProperName, searchChampions } from "../lib/championSearch";
import { getPollIntervalMs, shouldCheckNow, shouldCheckOnLaunch } from "../lib/autoUpdate";
import { isTauri } from "../lib/tauri";
import { CommandPalette } from "./CommandPalette";

const NAV_ITEMS = [
  { to: "/", label: "首页", icon: "🏠" },
  { to: "/tier-list", label: "强度榜", icon: "📊" },
  { to: "/augments", label: "强化符文", icon: "💎" },
  { to: "/settings", label: "设置", icon: "⚙️" },
];

function ChampionSearchBox() {
  const bundle = useDataStore((s) => s.bundle);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const champions = bundle?.champions ?? [];
  const searchIndex = useMemo(() => buildChampionSearchIndex(champions), [champions]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchChampions(searchIndex, query).slice(0, 8);
  }, [searchIndex, query]);

  const showDropdown = focused && query.trim().length > 0;

  function goTo(key: string) {
    navigate(`/champions/${key}`);
    setQuery("");
    inputRef.current?.blur();
  }

  return (
    <div className="relative mb-4 px-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) goTo(results[0].key);
            if (e.key === "Escape") inputRef.current?.blur();
          }}
          placeholder="搜索英雄…"
          disabled={!bundle}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/50 disabled:opacity-40"
        />
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-2 right-2 top-[calc(100%+4px)] z-50 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-[#181c25] p-1.5 shadow-xl shadow-black/40"
          >
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">未找到匹配的英雄</div>
            ) : (
              results.map((champion) => (
                <button
                  key={champion.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goTo(champion.key)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <ChampionAvatar src={champion.imageUrl} alt={champion.name} size={26} />
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm text-zinc-100">{getChampionProperName(champion)}</span>
                    <span className="truncate text-[11px] text-zinc-500">{champion.name}</span>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useAutoUpdateScheduler() {
  const loading = useDataStore((s) => s.loading);
  const checkUpdate = useDataStore((s) => s.checkUpdate);
  const settings = useSettingsStore((s) => s.settings);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const launchCheckedRef = useRef(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!isTauri || !settingsLoaded || loading) return;

    let cancelled = false;

    async function runCheck() {
      await checkUpdate();
      if (!cancelled) await loadSettings();
    }

    const latestSettings = useSettingsStore.getState().settings;
    if (!launchCheckedRef.current && shouldCheckOnLaunch(latestSettings)) {
      launchCheckedRef.current = true;
      void runCheck();
    }

    const pollMs = latestSettings.autoUpdate ? getPollIntervalMs(latestSettings.updateFrequency) : null;
    if (pollMs == null) return;

    const timer = window.setInterval(() => {
      // 读最新 settings，避免闭包过期
      const latest = useSettingsStore.getState().settings;
      if (shouldCheckNow(latest)) void runCheck();
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settingsLoaded, loading, settings.autoUpdate, settings.updateFrequency, checkUpdate, loadSettings]);
}

export function Layout() {
  const bundle = useDataStore((s) => s.bundle);
  const bootstrap = useDataStore((s) => s.bootstrap);
  const imageCacheProgress = useDataStore((s) => s.imageCacheProgress);
  const hasUpdateAvailable = useDataStore((s) => s.hasUpdateAvailable);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useAutoUpdateScheduler();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isModK) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-[#0b0d12] text-zinc-100">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-[#11141b] px-3 py-5">
        <div className="mb-5 px-2">
          <div className="text-lg font-bold tracking-wide">斗魂竞技场</div>
          <div className="mt-0.5 text-xs text-zinc-500">{bundle ? `补丁 ${bundle.patch}` : "数据未加载"}</div>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mb-3 mx-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left text-xs text-zinc-500 transition-colors hover:border-indigo-400/30 hover:text-zinc-300"
        >
          <span className="flex-1">搜索英雄…</span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">⌘K</kbd>
        </button>

        <ChampionSearchBox />

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={clsx(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "text-white" : "text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-bg"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/10 ring-1 ring-indigo-400/20"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{item.icon}</span>
                  <span className="relative z-10">{item.label}</span>
                  {item.to === "/settings" && hasUpdateAvailable && (
                    <span className="relative z-10 ml-auto h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" title="发现新数据" />
                  )}
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {hasUpdateAvailable && (
          <NavLink
            to="/settings"
            className="mx-2 mt-3 rounded-lg bg-indigo-500/15 px-3 py-2 text-xs font-medium text-indigo-200 ring-1 ring-indigo-400/30 transition-colors hover:bg-indigo-500/25"
          >
            发现新数据版本，前往更新 →
          </NavLink>
        )}

        <div className="mt-auto px-2 text-[11px] leading-relaxed text-zinc-600">
          {imageCacheProgress ? (
            <span className="text-indigo-400/80">
              正在缓存图标 {imageCacheProgress.done}/{imageCacheProgress.total}…
            </span>
          ) : (
            "数据来源 OP.GG · 离线缓存"
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
