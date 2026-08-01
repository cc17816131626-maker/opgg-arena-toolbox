# scraper

抓取 [OP.GG 斗魂竞技场（Arena）](https://op.gg/zh-cn/lol/modes/arena) 数据，生成离线 JSON 数据包，供桌面客户端下载使用。

## 抓取原理

OP.GG 是 Next.js App Router 站点，数据通过 React Server Components 的 "flight" 协议
（`self.__next_f.push(...)`）内嵌在服务端渲染的 HTML 里返回，**不需要跑无头浏览器**：

1. 用普通 HTTP GET 请求页面 HTML（`src/http.ts`）。
2. 从 HTML 里提取并拼接所有 flight chunk 文本，按行还原成 `chunkId -> value` 的映射
   （`src/flight/parse.ts`）。
3. 解析过程中会出现形如 `"$L4b"` / `"$55:props:children:..."` 的内部引用，递归展开成真实数据
   （`src/flight/resolve.ts`）。
4. 大部分数据（英雄强度榜、强化符文、技能加点、双人/三人组合）在展开后已经是干净的 JSON，
   直接用“按字段形状查找”的方式定位（`src/flight/find.ts`）。
5. 「出装」Tab 的数据没有单独的 JSON，只是渐进渲染成了 React 元素树，所以额外写了一个极简的
   伪 DOM 渲染器把它转成 HTML 字符串（`src/flight/render.ts`），再用 cheerio 当成普通网页解析
   （`src/itemTable.ts`）。

这样实现的好处：不依赖 Playwright/Chromium，抓取更快、更稳定，也避开了 op.gg 对无头浏览器的
反爬拦截（纯 HTTP 请求不会触发）。

## 本地使用

```bash
pnpm install
pnpm scrape              # 抓取全部英雄
pnpm scrape:limit        # 只抓前 5 个英雄，用于快速验证
npx tsx src/index.ts --limit=20 --concurrency=4 --delayMs=600
```

输出在 `output/`：

- `arena-data.json` / `arena-data.json.gz`：完整数据包
- `manifest.json`：版本信息 + sha256 校验值 + 下载地址

## CLI 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--limit` | 不限制 | 只抓前 N 个英雄，调试用 |
| `--outDir` | `output` | 输出目录 |
| `--delayMs` | `600` | 同一英雄各请求之间、不同英雄之间的等待时间 |
| `--concurrency` | `4` | 同时抓取的英雄数 |
| `--championRetries` | `2` | 单个英雄失败后的重试次数 |

## 数据校验与容错

- 英雄数量低于 100（正常应有 150+）会直接中止，避免页面结构变化导致发布空数据。
- 单个英雄抓取失败会重试，仍失败则跳过；整体失败率超过 10% 会中止整个流程并以非零状态码退出，
  CI 里会因此不发布这次结果，仓库里保留上一个有效版本。

## GitHub Actions

`.github/workflows/scrape.yml` 每天定时跑一次（也支持手动 `workflow_dispatch`）：
抓取 → 生成数据包 → 发布到 GitHub Release → 把最新 `manifest.json` 提交到仓库 `data/` 目录。
桌面客户端只需要请求 `data/manifest.json`（通过 `raw.githubusercontent.com`）就能判断是否有新版本。
