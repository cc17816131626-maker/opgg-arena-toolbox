import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "./tauri";

const REPO = "cc17816131626-maker/opgg-arena-toolbox";
const CURRENT_VERSION = "0.1.0";

export interface AppReleaseInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  downloadUrl: string | null;
}

function normalizeTag(tag: string): string {
  return tag.replace(/^app-v/i, "").replace(/^v/i, "");
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((x) => Number(x) || 0);
  const pb = b.split(".").map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** 通过 GitHub Releases 检查客户端本体是否有新版本 */
export async function checkAppRelease(): Promise<AppReleaseInfo> {
  const currentVersion = CURRENT_VERSION;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`);
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const releases = (await res.json()) as Array<{
      tag_name: string;
      html_url: string;
      draft: boolean;
      prerelease: boolean;
      assets: Array<{ name: string; browser_download_url: string }>;
    }>;

    const appRelease = releases.find((r) => !r.draft && !r.prerelease && /^app-v/i.test(r.tag_name));
    if (!appRelease) {
      return { currentVersion, latestVersion: null, hasUpdate: false, releaseUrl: null, downloadUrl: null };
    }

    const latestVersion = normalizeTag(appRelease.tag_name);
    const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
    const prefer =
      appRelease.assets.find((a) => a.name.endsWith(".dmg")) ||
      appRelease.assets.find((a) => a.name.endsWith(".msi")) ||
      appRelease.assets.find((a) => a.name.endsWith(".exe")) ||
      null;

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl: appRelease.html_url,
      downloadUrl: prefer?.browser_download_url ?? null,
    };
  } catch {
    return { currentVersion, latestVersion: null, hasUpdate: false, releaseUrl: null, downloadUrl: null };
  }
}

export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export { CURRENT_VERSION };
