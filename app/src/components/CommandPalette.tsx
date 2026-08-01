import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildChampionSearchIndex, getChampionProperName, searchChampions } from "../lib/championSearch";
import { useDataStore } from "../store/dataStore";
import { ChampionAvatar } from "./ChampionAvatar";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const bundle = useDataStore((s) => s.bundle);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const champions = bundle?.champions ?? [];
  const searchIndex = useMemo(() => buildChampionSearchIndex(champions), [champions]);
  const results = useMemo(() => {
    if (!query.trim()) return champions.slice(0, 10);
    return searchChampions(searchIndex, query).slice(0, 10);
  }, [champions, searchIndex, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function goTo(key: string) {
    navigate(`/champions/${key}`);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-label="搜索英雄"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#161a22] shadow-2xl shadow-black/50"
          >
            <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
              <span className="text-zinc-500">🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onClose();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === "Enter" && results[activeIndex]) {
                    e.preventDefault();
                    goTo(results[activeIndex].key);
                  }
                }}
                placeholder={bundle ? "搜索英雄名 / 拼音…" : "请先加载数据"}
                disabled={!bundle}
                className="flex-1 bg-transparent py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-40"
              />
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">ESC</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5">
              {!bundle ? (
                <div className="px-3 py-6 text-center text-xs text-zinc-500">暂无数据，请先在设置页导入</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-zinc-500">未找到匹配的英雄</div>
              ) : (
                results.map((champion, index) => (
                  <button
                    key={champion.key}
                    onClick={() => goTo(champion.key)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      index === activeIndex ? "bg-indigo-500/20" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <ChampionAvatar src={champion.imageUrl} alt={champion.name} size={28} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm text-zinc-100">{getChampionProperName(champion)}</div>
                      <div className="truncate text-[11px] text-zinc-500">{champion.name}</div>
                    </div>
                    <span className="text-[11px] text-zinc-600">#{champion.rank}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
