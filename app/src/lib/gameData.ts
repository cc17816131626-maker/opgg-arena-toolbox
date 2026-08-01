import type { ArenaDataBundle } from "../types";

/**
 * 递归收集数据包里所有 `xxxImageUrl` 字段的值：英雄头像、装备图标、海克斯图标、
 * 队友头像等等全部一网打尽，用于数据更新后统一预热本地图片缓存。
 */
export function collectImageUrls(bundle: ArenaDataBundle): string[] {
  const urls = new Set<string>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (typeof value === "string") {
          if (/imageurl/i.test(key) && value) urls.add(value);
        } else if (value && typeof value === "object") {
          visit(value);
        }
      }
    }
  };

  visit(bundle.champions);
  visit(bundle.championDetails);
  return Array.from(urls);
}
