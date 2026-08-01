import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./tauri";

/** 内存里的 url -> 本地 asset:// 地址映射，同一次运行里查过的图片不用再问 Rust 端 */
const resolvedCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** 同步查一次内存缓存，命中就用本地路径，没命中先用远程地址兜底（不阻塞渲染） */
export function resolveImageSrc(url: string): string {
  if (!url) return url;
  return resolvedCache.get(url) ?? url;
}

/** 单张图片按需缓存：找不到时让 Rust 端下载一次并记录本地路径 */
export async function ensureImageCached(url: string): Promise<string> {
  if (!url || !isTauri) return url;
  const cached = resolvedCache.get(url);
  if (cached) return cached;
  const inflight = pending.get(url);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const path = await invoke<string>("get_cached_image_path", { url });
      const assetSrc = convertFileSrc(path);
      resolvedCache.set(url, assetSrc);
      return assetSrc;
    } catch {
      // 下载失败（比如离线且从未缓存过），保持用远程地址，不影响其它图标
      return url;
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, task);
  return task;
}

export interface ImageCacheProgress {
  done: number;
  total: number;
}

/**
 * 批量预热缓存：数据下载完成后调用一次，把这一批用得到的图片全部提前缓存到本地，
 * 这样即使之后断网，头像/装备/海克斯图标也能正常显示。已经缓存过的图片 Rust 端会跳过下载，
 * 所以重复调用是安全且轻量的。
 */
export async function warmImageCache(
  urls: string[],
  onProgress?: (progress: ImageCacheProgress) => void,
): Promise<void> {
  if (!isTauri) return;
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (unique.length === 0) return;

  let unlisten: (() => void) | undefined;
  if (onProgress) {
    unlisten = await listen<ImageCacheProgress>("image-cache-progress", (event) => onProgress(event.payload));
  }

  try {
    const map = await invoke<Record<string, string>>("cache_images_bulk", { urls: unique });
    for (const [url, path] of Object.entries(map)) {
      resolvedCache.set(url, convertFileSrc(path));
    }
  } finally {
    unlisten?.();
  }
}
