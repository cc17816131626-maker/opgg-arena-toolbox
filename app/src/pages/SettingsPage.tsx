import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDataStore } from "../store/dataStore";
import { useSettingsStore } from "../store/settingsStore";
import { clearImageCache, formatInvokeError, getImageCacheInfo, type ImageCacheInfo } from "../lib/tauri";
import type { UpdateFrequency } from "../types";

const FREQ_OPTIONS: { key: UpdateFrequency; label: string }[] = [
  { key: "onLaunch", label: "每次启动时" },
  { key: "every6Hours", label: "每 6 小时" },
  { key: "daily", label: "每天一次" },
  { key: "manual", label: "仅手动检查" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "从未";
  try {
    return new Date(iso).toLocaleString("zh-CN");
  } catch {
    return iso;
  }
}

export function SettingsPage() {
  const manifest = useDataStore((s) => s.manifest);
  const updatePhase = useDataStore((s) => s.updatePhase);
  const updateError = useDataStore((s) => s.updateError);
  const downloadProgress = useDataStore((s) => s.downloadProgress);
  const hasUpdateAvailable = useDataStore((s) => s.hasUpdateAvailable);
  const remoteManifest = useDataStore((s) => s.remoteManifest);
  const checkUpdate = useDataStore((s) => s.checkUpdate);
  const applyUpdate = useDataStore((s) => s.applyUpdate);
  const downloadNow = useDataStore((s) => s.downloadNow);
  const importBundled = useDataStore((s) => s.importBundled);
  const hasLocalData = !!manifest;

  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const updateSettings = useSettingsStore((s) => s.update);

  const [cacheInfo, setCacheInfo] = useState<ImageCacheInfo | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const refreshCacheInfo = useCallback(async () => {
    try {
      setCacheInfo(await getImageCacheInfo());
    } catch {
      setCacheInfo(null);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    void refreshCacheInfo();
  }, [loadSettings, refreshCacheInfo]);

  async function handleClearCache() {
    setCacheBusy(true);
    setCacheMessage(null);
    try {
      const next = await clearImageCache();
      setCacheInfo(next);
      setCacheMessage("图片缓存已清空。重新打开英雄页时会按需重新下载。");
    } catch (err) {
      setCacheMessage(formatInvokeError(err));
    } finally {
      setCacheBusy(false);
    }
  }

  const progressPct = downloadProgress && downloadProgress.totalBytes > 0
    ? Math.min(100, (downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)
    : updatePhase === "downloading" ? 8 : 0;

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <h1 className="mb-6 text-xl font-bold">设置</h1>

      <section className="mb-6 rounded-xl bg-white/[0.02] p-5 ring-1 ring-white/5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">数据版本</h2>
        <div className="space-y-2 text-sm">
          <Row label="当前版本" value={manifest?.version ?? "未下载"} />
          <Row label="对应补丁" value={manifest?.patch ?? "-"} />
          <Row label="生成时间" value={manifest ? formatDate(manifest.generatedAt) : "-"} />
          <Row label="数据大小" value={manifest ? formatBytes(manifest.sizeBytes) : "-"} />
          <Row label="上次检查更新" value={formatDate(settings.lastCheckedAt)} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          {!hasLocalData ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={downloadNow}
              disabled={updatePhase === "checking" || updatePhase === "downloading"}
              className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-400 disabled:opacity-50"
            >
              {updatePhase === "checking"
                ? "正在连接…"
                : updatePhase === "downloading"
                  ? "正在下载…"
                  : "⬇ 下载数据"}
            </motion.button>
          ) : (
            <>
              <button
                onClick={checkUpdate}
                disabled={updatePhase === "checking" || updatePhase === "downloading"}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {updatePhase === "checking" ? "检查中…" : "检查更新"}
              </button>

              <AnimatePresence>
                {hasUpdateAvailable && updatePhase !== "downloading" && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={applyUpdate}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                  >
                    发现新版本 {remoteManifest?.version} · 立即更新
                  </motion.button>
                )}
              </AnimatePresence>

              <button
                onClick={importBundled}
                disabled={updatePhase === "checking" || updatePhase === "downloading"}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                重新导入内置数据
              </button>
            </>
          )}

          {updatePhase === "success" && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-emerald-400">
              ✓ {manifest?.version?.startsWith("bundled-") ? "已导入内置数据包" : "已更新到最新数据"}
            </motion.span>
          )}
        </div>

        {updatePhase === "idle" && (
          <p className="mt-3 text-xs text-zinc-500">
            {!hasLocalData
              ? "首次使用点上面的「下载数据」。若远程更新还没配置，会自动导入安装包自带的离线数据。"
              : "远程更新未配置时，可用「重新导入内置数据」把安装包自带的最新离线数据覆盖到本地。"}
          </p>
        )}

        <AnimatePresence>
          {updatePhase === "downloading" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="mb-1.5 flex justify-between text-xs text-zinc-400">
                <span>正在下载数据包…</span>
                <span>
                  {downloadProgress
                    ? `${formatBytes(downloadProgress.downloadedBytes)} / ${formatBytes(downloadProgress.totalBytes)}`
                    : "正在连接…"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-400"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {updatePhase === "error" && updateError && (
          <div className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-400/20">
            {updateError}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl bg-white/[0.02] p-5 ring-1 ring-white/5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">图片缓存</h2>
        <div className="mb-4 space-y-2 text-sm">
          <Row label="缓存文件数" value={cacheInfo ? String(cacheInfo.fileCount) : "-"} />
          <Row label="占用空间" value={cacheInfo ? formatBytes(cacheInfo.totalBytes) : "-"} />
        </div>
        <button
          onClick={handleClearCache}
          disabled={cacheBusy || !cacheInfo || cacheInfo.fileCount === 0}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {cacheBusy ? "清理中…" : "清理图片缓存"}
        </button>
        {cacheMessage && <p className="mt-3 text-xs text-zinc-500">{cacheMessage}</p>}
      </section>

      <section className="rounded-xl bg-white/[0.02] p-5 ring-1 ring-white/5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">自动更新</h2>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-zinc-300">启用自动检查更新</span>
          <button
            onClick={() => updateSettings({ autoUpdate: !settings.autoUpdate })}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              settings.autoUpdate ? "bg-indigo-500" : "bg-white/10"
            }`}
          >
            <motion.span
              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow"
              animate={{ x: settings.autoUpdate ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            />
          </button>
        </div>

        <div className={`grid grid-cols-2 gap-2 transition-opacity ${settings.autoUpdate ? "" : "pointer-events-none opacity-40"}`}>
          {FREQ_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateSettings({ updateFrequency: opt.key })}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium ring-1 transition-colors ${
                settings.updateFrequency === opt.key
                  ? "bg-indigo-500/15 text-indigo-200 ring-indigo-400/40"
                  : "bg-white/[0.02] text-zinc-400 ring-white/10 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
