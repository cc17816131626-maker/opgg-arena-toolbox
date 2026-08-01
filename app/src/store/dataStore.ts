import { create } from "zustand";
import type { ArenaDataBundle, DownloadProgress, Manifest } from "../types";
import {
  checkForUpdate,
  downloadAndApplyUpdate,
  formatInvokeError,
  getLocalData,
  getLocalManifest,
  importBundledData,
  isTauri,
  onDownloadProgress,
} from "../lib/tauri";
import { collectImageUrls } from "../lib/gameData";
import { warmImageCache, type ImageCacheProgress } from "../lib/imageCache";

export type UpdatePhase = "idle" | "checking" | "downloading" | "success" | "error";

interface DataState {
  bundle: ArenaDataBundle | null;
  manifest: Manifest | null;
  loading: boolean;
  loadError: string | null;

  updatePhase: UpdatePhase;
  updateError: string | null;
  downloadProgress: DownloadProgress | null;
  hasUpdateAvailable: boolean;
  remoteManifest: Manifest | null;
  imageCacheProgress: ImageCacheProgress | null;

  bootstrap: () => Promise<void>;
  checkUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  /** 首次使用没有任何本地数据时用：优先远程下载，失败则回退到内置数据包 */
  downloadNow: () => Promise<void>;
  /** 强制用安装包内置数据覆盖本地（开发/远程未配置时刷新用） */
  importBundled: () => Promise<void>;
}

/** 数据加载/更新完成后，把这批数据用到的所有图片预热进本地缓存（不阻塞界面渲染） */
function warmImagesInBackground(bundle: ArenaDataBundle | null, set: (partial: Partial<DataState>) => void) {
  if (!bundle || !isTauri) return;
  const urls = collectImageUrls(bundle);
  warmImageCache(urls, (progress) => set({ imageCacheProgress: progress })).finally(() => {
    set({ imageCacheProgress: null });
  });
}

async function loadSampleData(): Promise<ArenaDataBundle | null> {
  try {
    const res = await fetch("/sample-data.json");
    if (!res.ok) return null;
    return (await res.json()) as ArenaDataBundle;
  } catch {
    return null;
  }
}

async function reloadLocalState(): Promise<{ bundle: ArenaDataBundle | null; manifest: Manifest | null }> {
  const [bundle, manifest] = await Promise.all([getLocalData(), getLocalManifest()]);
  return { bundle, manifest };
}

export const useDataStore = create<DataState>((set, get) => ({
  bundle: null,
  manifest: null,
  loading: true,
  loadError: null,

  updatePhase: "idle",
  updateError: null,
  downloadProgress: null,
  hasUpdateAvailable: false,
  remoteManifest: null,
  imageCacheProgress: null,

  bootstrap: async () => {
    set({ loading: true, loadError: null });
    try {
      let bundle = await getLocalData();
      const manifest = await getLocalManifest();
      if (!bundle && !isTauri) {
        // 纯浏览器开发模式下没有 Tauri 后端，用打包的示例数据方便调界面
        bundle = await loadSampleData();
      }
      set({ bundle, manifest, loading: false });
      warmImagesInBackground(bundle, set);
    } catch (err) {
      set({ loading: false, loadError: formatInvokeError(err) });
    }
  },

  checkUpdate: async () => {
    set({ updatePhase: "checking", updateError: null });
    try {
      const result = await checkForUpdate();
      set({
        updatePhase: "idle",
        hasUpdateAvailable: result.hasUpdate,
        remoteManifest: result.remoteManifest,
      });
    } catch (err) {
      set({ updatePhase: "error", updateError: formatInvokeError(err) });
    }
  },

  applyUpdate: async () => {
    set({ updatePhase: "downloading", updateError: null, downloadProgress: null });
    const unlisten = onDownloadProgress((progress) => set({ downloadProgress: progress }));
    try {
      const manifest = await downloadAndApplyUpdate();
      const { bundle } = await reloadLocalState();
      set({
        updatePhase: "success",
        manifest,
        bundle: bundle ?? get().bundle,
        hasUpdateAvailable: false,
        downloadProgress: null,
      });
      warmImagesInBackground(bundle, set);
    } catch (err) {
      set({ updatePhase: "error", updateError: formatInvokeError(err) });
    } finally {
      unlisten();
    }
  },

  downloadNow: async () => {
    set({ updatePhase: "checking", updateError: null });
    try {
      const result = await checkForUpdate();
      set({ hasUpdateAvailable: result.hasUpdate, remoteManifest: result.remoteManifest });
      if (result.hasUpdate) {
        await get().applyUpdate();
      } else {
        const { bundle, manifest } = await reloadLocalState();
        set({
          updatePhase: "success",
          bundle: bundle ?? get().bundle,
          manifest: manifest ?? get().manifest,
        });
      }
    } catch (remoteErr) {
      // 远程还没配好（REPLACE_ME）或网络不通时，回退到安装包自带的种子数据，
      // 保证「下载数据」按钮至少能把本地数据补上，而不是看起来没反应。
      try {
        set({ updatePhase: "downloading", updateError: null });
        const manifest = await importBundledData();
        const { bundle } = await reloadLocalState();
        set({
          updatePhase: "success",
          manifest,
          bundle: bundle ?? get().bundle,
          hasUpdateAvailable: false,
          downloadProgress: null,
          updateError: null,
        });
        warmImagesInBackground(bundle, set);
      } catch (fallbackErr) {
        set({
          updatePhase: "error",
          updateError: `远程更新不可用：${formatInvokeError(remoteErr)}；内置数据也导入失败：${formatInvokeError(fallbackErr)}`,
        });
      }
    }
  },

  importBundled: async () => {
    set({ updatePhase: "downloading", updateError: null, downloadProgress: null });
    try {
      const manifest = await importBundledData();
      const { bundle } = await reloadLocalState();
      set({
        updatePhase: "success",
        manifest,
        bundle: bundle ?? get().bundle,
        hasUpdateAvailable: false,
        downloadProgress: null,
      });
      warmImagesInBackground(bundle, set);
    } catch (err) {
      set({ updatePhase: "error", updateError: formatInvokeError(err) });
    }
  },
}));
