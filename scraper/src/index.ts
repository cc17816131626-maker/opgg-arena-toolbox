import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { scrapeOverview } from "./scrapeOverview.js";
import { scrapeChampion } from "./scrapeChampion.js";
import { buildManifest } from "./manifest.js";
import { sleep } from "./http.js";
import { validateBundle } from "./schema.js";
import { buildDiffReport, formatDiffReport, loadPreviousBundle } from "./diffReport.js";
import type { ArenaDataBundle, ChampionDetail } from "./types.js";

interface CliArgs {
  limit?: number;
  outDir: string;
  delayMs: number;
  concurrency: number;
  /** 单个英雄抓取失败时的重试次数 */
  championRetries: number;
  /** GitHub Release 资产的下载地址模板，{version} 会被替换成实际版本号 */
  dataUrlTemplate: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    outDir: "output",
    delayMs: 600,
    concurrency: 4,
    championRetries: 2,
    dataUrlTemplate:
      process.env.ARENA_DATA_URL_TEMPLATE ??
      "https://github.com/cc17816131626-maker/opgg-arena-toolbox/releases/download/{version}/arena-data.json.gz",
  };
  for (const arg of argv) {
    const m = /^--(\w+)=(.*)$/.exec(arg);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "limit") args.limit = Number(value);
    else if (key === "outDir") args.outDir = value;
    else if (key === "delayMs") args.delayMs = Number(value);
    else if (key === "concurrency") args.concurrency = Number(value);
    else if (key === "championRetries") args.championRetries = Number(value);
  }
  return args;
}

/** 简单的并发限制器：保证最多同时有 `limit` 个任务在跑，避免对 op.gg 发起过多并发请求 */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function runNext(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index], index);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("[scraper] 抓取斗魂竞技场总览榜...");
  const { champions, patch } = await scrapeOverview();
  console.log(`[scraper] 共 ${champions.length} 名英雄，当前版本 ${patch}`);

  if (champions.length < 100) {
    // 正常情况下斗魂竞技场可登场的英雄有 150+ 个，明显偏少说明总览页解析可能出错，
    // 直接中止整个流程，避免发布一份不完整的数据包覆盖掉仓库里上一个好的版本。
    throw new Error(`解析出的英雄数量异常偏少（${champions.length}），可能是页面结构发生变化，中止抓取`);
  }

  const targets = args.limit ? champions.slice(0, args.limit) : champions;
  const championDetails: Record<string, ChampionDetail> = {};
  const failedKeys: string[] = [];
  let completed = 0;

  await runWithConcurrency(targets, args.concurrency, async (c) => {
    for (let attempt = 0; attempt <= args.championRetries; attempt++) {
      try {
        championDetails[c.key] = await scrapeChampion(c, { delayMs: args.delayMs });
        break;
      } catch (err) {
        if (attempt < args.championRetries) {
          await sleep(args.delayMs * (attempt + 1) * 2);
          continue;
        }
        console.error(`[scraper] 抓取 ${c.key} 失败，跳过：`, (err as Error).message);
        failedKeys.push(c.key);
      }
    }
    completed++;
    console.log(`[scraper] (${completed}/${targets.length}) ${c.name} (${c.key}) 完成`);
  });

  const failureRate = failedKeys.length / targets.length;
  if (failureRate > 0.1) {
    throw new Error(`抓取失败率过高（${failedKeys.length}/${targets.length}），中止发布。失败英雄：${failedKeys.join(", ")}`);
  }
  if (failedKeys.length > 0) {
    console.warn(`[scraper] 以下英雄抓取失败，已跳过：${failedKeys.join(", ")}`);
  }

  const generatedAt = new Date().toISOString();
  const bundle: ArenaDataBundle = {
    schemaVersion: 1,
    patch,
    generatedAt,
    champions,
    championDetails,
  };

  console.log("[scraper] 校验数据包 schema…");
  validateBundle(bundle);

  await mkdir(args.outDir, { recursive: true });

  const previous = await loadPreviousBundle(path.join(args.outDir, "arena-data.json"));
  const diff = buildDiffReport(previous, bundle);
  const diffText = formatDiffReport(diff);
  console.log(`[scraper] 数据变更：\n${diffText}`);

  const jsonBuf = Buffer.from(JSON.stringify(bundle), "utf-8");
  const gzBuf = gzipSync(jsonBuf, { level: 9 });

  const dataFileName = "arena-data.json.gz";
  await writeFile(path.join(args.outDir, dataFileName), gzBuf);
  await writeFile(path.join(args.outDir, "arena-data.json"), jsonBuf);
  await writeFile(path.join(args.outDir, "diff-report.json"), JSON.stringify(diff, null, 2));
  await writeFile(path.join(args.outDir, "diff-report.txt"), `${diffText}\n`);

  const manifest = buildManifest({
    patch,
    generatedAt,
    dataBuffer: gzBuf,
    dataUrl: "", // 占位，下面替换成真实版本号后的下载地址
  });
  manifest.dataUrl = args.dataUrlTemplate.replace("{version}", manifest.version);

  await writeFile(path.join(args.outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`[scraper] 完成。数据包大小（gzip）：${(gzBuf.length / 1024).toFixed(1)} KB`);
  console.log(`[scraper] manifest:`, manifest);
}

main().catch((err) => {
  console.error("[scraper] 抓取失败：", err);
  process.exitCode = 1;
});
