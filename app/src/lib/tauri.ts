import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AppSettings, ArenaDataBundle, DownloadProgress, Manifest } from "../types";

export interface CheckUpdateResult {
  hasUpdate: boolean;
  remoteManifest: Manifest;
  localManifest: Manifest | null;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Tauri 的 invoke 失败时经常直接抛出字符串，而不是带 message 的 Error */
export function formatInvokeError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const maybe = err as { message?: unknown; error?: unknown };
    if (typeof maybe.message === "string" && maybe.message) return maybe.message;
    if (typeof maybe.error === "string" && maybe.error) return maybe.error;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function getLocalData(): Promise<ArenaDataBundle | null> {
  if (!isTauri) return null;
  const raw = await invoke<string | null>("get_local_data");
  return raw ? (JSON.parse(raw) as ArenaDataBundle) : null;
}

export async function getLocalManifest(): Promise<Manifest | null> {
  if (!isTauri) return null;
  return invoke<Manifest | null>("get_local_manifest");
}

export async function checkForUpdate(): Promise<CheckUpdateResult> {
  if (!isTauri) throw new Error("当前为浏览器预览模式，无法连接更新服务，请在桌面客户端中使用此功能");
  return invoke<CheckUpdateResult>("check_for_update");
}

export async function downloadAndApplyUpdate(): Promise<Manifest> {
  if (!isTauri) throw new Error("当前为浏览器预览模式，无法连接更新服务，请在桌面客户端中使用此功能");
  return invoke<Manifest>("download_and_apply_update");
}

/** 把安装包自带的种子数据写入本地（远程更新服务还没配好 / 离线时用） */
export async function importBundledData(): Promise<Manifest> {
  if (!isTauri) throw new Error("当前为浏览器预览模式，请在桌面客户端中使用此功能");
  return invoke<Manifest>("import_bundled_data");
}

export async function getSettings(): Promise<AppSettings> {
  if (!isTauri) {
    return { autoUpdate: true, updateFrequency: "onLaunch", lastCheckedAt: null };
  }
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isTauri) return;
  await invoke("save_settings", { settings });
}

export interface ImageCacheInfo {
  fileCount: number;
  totalBytes: number;
}

export async function getImageCacheInfo(): Promise<ImageCacheInfo> {
  if (!isTauri) return { fileCount: 0, totalBytes: 0 };
  return invoke<ImageCacheInfo>("get_image_cache_info");
}

export async function clearImageCache(): Promise<ImageCacheInfo> {
  if (!isTauri) return { fileCount: 0, totalBytes: 0 };
  return invoke<ImageCacheInfo>("clear_image_cache");
}

export function onDownloadProgress(cb: (progress: DownloadProgress) => void): () => void {
  if (!isTauri) return () => {};
  const unlisten = listen<DownloadProgress>("download-progress", (event) => cb(event.payload));
  return () => {
    unlisten.then((fn) => fn());
  };
}

export { isTauri };
