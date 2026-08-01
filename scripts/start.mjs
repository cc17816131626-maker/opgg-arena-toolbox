#!/usr/bin/env node
/**
 * 一键启动脚本：自动检查依赖 → 安装依赖（如需要）→ 拉起 Tauri 桌面客户端（开发模式）。
 * 跨平台（macOS / Windows / Linux）均可直接用 `pnpm start` 或 `node scripts/start.mjs` 运行。
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const isWindows = process.platform === "win32";

const color = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function log(msg) {
  console.log(`${color.cyan("[启动]")} ${msg}`);
}

function commandExists(cmd) {
  const probe = isWindows ? "where" : "which";
  const res = spawnSync(probe, [cmd], { stdio: "ignore", shell: isWindows });
  return res.status === 0;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: isWindows,
      ...opts,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`))));
    child.on("error", reject);
  });
}

async function main() {
  console.log("");
  console.log(color.green("========================================"));
  console.log(color.green("  斗魂竞技场助手 · 一键启动"));
  console.log(color.green("========================================"));
  console.log("");

  // 1. 检查必要工具
  const missing = [];
  if (!commandExists("pnpm")) missing.push("pnpm（https://pnpm.io/installation）");
  if (!commandExists("cargo")) missing.push("Rust 工具链（https://www.rust-lang.org/tools/install）");
  if (missing.length > 0) {
    console.log(color.red("缺少以下依赖，请先安装后重试："));
    for (const m of missing) console.log(`  - ${m}`);
    process.exitCode = 1;
    return;
  }

  // 2. 检查依赖是否已安装，没有就自动装一次
  const needInstall =
    !existsSync(path.join(ROOT, "node_modules")) || !existsSync(path.join(ROOT, "app", "node_modules"));
  if (needInstall) {
    log("首次运行，正在安装依赖（pnpm install）…");
    await run("pnpm", ["install"]);
  } else {
    log("依赖已就位，跳过安装（如需强制重装请运行 pnpm install）");
  }

  // 3. 拉起 Tauri 桌面客户端开发模式（内部会自动起 Vite + cargo run）
  log("正在启动桌面客户端（开发模式），首次启动需要编译 Rust 后端，请耐心等待…");
  console.log(color.dim("提示：窗口出现后即可开始使用；按 Ctrl+C 可随时退出。\n"));
  await run("pnpm", ["--filter", "app", "tauri", "dev"]);
}

main().catch((err) => {
  console.error(color.red(`\n启动失败：${err.message}`));
  process.exitCode = 1;
});
