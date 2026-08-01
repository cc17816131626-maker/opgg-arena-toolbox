# 斗魂竞技场助手

基于 [OP.GG](https://op.gg) 数据的英雄联盟「斗魂竞技场（Arena）」离线桌面工具。数据由独立的抓取流水线定期更新并发布，桌面客户端首次启动下载一次后即可完全离线使用，支持自动/手动检查更新并带下载进度条。

## 仓库结构

```
/
├── scraper/          # 数据抓取流水线（Node + TypeScript），解析 OP.GG 页面内嵌的 Next.js Flight 数据
│   └── README.md     # 抓取原理、本地用法、CLI 参数说明
├── app/              # Tauri 2.x 桌面客户端（React + TS + Tailwind + Framer Motion + Zustand）
│   ├── src/          # 前端：强度榜 / 强化符文榜 / 英雄详情 / 设置
│   └── src-tauri/    # Rust 后端：下载、校验、本地存储、设置持久化
├── data/             # manifest.json（客户端据此判断是否有新版本数据）
└── .github/workflows/
    ├── scrape.yml      # 每日定时抓取并发布数据包到 GitHub Release
    └── build-app.yml   # 构建 Win(.msi/.exe) 与 Mac(.dmg) 安装包
```

## 功能

- **英雄强度榜**：按 Tier / 胜率 / 登场率 / 禁用率 / 吃鸡率 / 平均名次排序筛选，支持搜索
- **强化符文榜**：按稀有度分组展示全英雄汇总选用数据
- **英雄详情页**：出装、加点、强化符文、双人组合（含多人组合）4 个 Tab
- **设置页**：自动/手动更新频率配置、当前数据版本信息、手动检查更新（带下载进度条）

## 本地开发

### 一键启动（推荐）

首次使用需要装好 [Node.js](https://nodejs.org)（≥20）、[pnpm](https://pnpm.io/installation) 和 [Rust 工具链](https://www.rust-lang.org/tools/install)，之后：

```bash
pnpm start
```

会自动检查/安装依赖，然后直接拉起 Tauri 桌面客户端（开发模式，带热更新）。也可以不开终端，双击仓库根目录下的 `start.command`（macOS，右键“打开”一次绕过安全限制）或 `start.bat`（Windows）。

### 手动分步

```bash
pnpm install

# 前端开发（不依赖 Tauri，会自动加载 app/public/sample-data.json 作为示例数据）
pnpm dev:app

# 跑通 Tauri 桌面客户端（需要 Rust 工具链）
pnpm --filter app tauri dev

# 运行一次抓取脚本
pnpm scraper scrape
```

## 数据更新流程

1. `scrape.yml` 每日定时（或手动触发）运行抓取脚本，生成 `arena-data.json.gz` 并发布到 GitHub Release，同时把 `manifest.json` 提交到 `data/` 目录
2. 客户端启动时按设置里的更新频率自动检查远程 `data/manifest.json`（也可在设置页手动检查）；发现新版本时侧栏「设置」会出现提示
3. 确认更新后，Rust 端流式下载数据包并上报进度，校验 SHA256 后原子替换本地数据文件

## 首次发布到 GitHub（打通远程更新）

仓库默认远程地址是占位符。按下面做一次即可：

1. `gh auth login`（如尚未登录）
2. 创建并推送仓库，例如：`gh repo create <你的仓库名> --public --source=. --remote=origin --push`
3. 编辑 [`config/github.json`](config/github.json)，填入真实的 `owner` / `repo`
4. 运行 `pnpm configure:github`，把地址写入客户端与抓取器默认配置
5. 在 GitHub Actions 手动触发一次 `scrape.yml`，确认 Release 与 `data/manifest.json` 提交成功
6. 打标签发布安装包：`git tag app-v0.1.0 && git push origin app-v0.1.0`（触发 `build-app.yml`）

也可不改代码，构建时用环境变量覆盖：`ARENA_MANIFEST_URL`（见 `.env.example`）。

## 打包发布

推送 `app-v*` 标签或手动触发 `build-app.yml`，会在 `macos-latest` / `windows-latest` 上分别构建并产出 `.dmg`、`.msi`/`.exe` 安装包到 GitHub Release（草稿状态，需手动发布）。
