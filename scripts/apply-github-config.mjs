#!/usr/bin/env node
/**
 * 把 config/github.json 里的 owner/repo 写进客户端 / 抓取器的默认远程地址。
 * 推仓库上 GitHub 后改好 config/github.json，再跑：
 *   node scripts/apply-github-config.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(path.join(root, "config/github.json"), "utf8"));
const { owner, repo } = config;

if (!owner || !repo || owner === "REPLACE_ME" || repo === "REPLACE_ME") {
  console.error("[apply-github-config] 请先在 config/github.json 填入真实的 owner / repo");
  process.exit(1);
}

const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/data/manifest.json`;
const dataUrlTemplate = `https://github.com/${owner}/${repo}/releases/download/{version}/arena-data.json.gz`;

const updateRsPath = path.join(root, "app/src-tauri/src/update.rs");
let updateRs = readFileSync(updateRsPath, "utf8");
updateRs = updateRs.replace(
  /const DEFAULT_MANIFEST_URL: &str =\s*"[^"]*";/,
  `const DEFAULT_MANIFEST_URL: &str =\n    "${manifestUrl}";`,
);
writeFileSync(updateRsPath, updateRs);

const indexTsPath = path.join(root, "scraper/src/index.ts");
let indexTs = readFileSync(indexTsPath, "utf8");
indexTs = indexTs.replace(
  /process\.env\.ARENA_DATA_URL_TEMPLATE \?\?\s*"[^"]*"/,
  `process.env.ARENA_DATA_URL_TEMPLATE ??\n      "${dataUrlTemplate}"`,
);
writeFileSync(indexTsPath, indexTs);

console.log("[apply-github-config] 已写入：");
console.log(`  manifest: ${manifestUrl}`);
console.log(`  dataUrl : ${dataUrlTemplate}`);
