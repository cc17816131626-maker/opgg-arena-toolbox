const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FetchHtmlOptions {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public retryAfterMs?: number,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status === 503 || status >= 500;
}

function backoffMs(attempt: number, baseDelayMs: number, retryAfterMs?: number): number {
  if (retryAfterMs != null) {
    return retryAfterMs + Math.floor(Math.random() * 500);
  }
  return Math.min(30_000, baseDelayMs * 2 ** attempt);
}

export async function fetchHtml(url: string, opts: FetchHtmlOptions = {}): Promise<string> {
  const { retries = 3, retryDelayMs = 1500, timeoutMs = 20000 } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        signal: controller.signal,
      });

      if (res.ok) {
        return await res.text();
      }

      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
      const err = new HttpError(res.status, url, retryAfterMs);
      lastErr = err;

      if (!isRetryableStatus(res.status) || attempt >= retries) {
        throw err;
      }

      const wait = backoffMs(attempt, retryDelayMs, retryAfterMs);
      console.warn(`[http] ${res.status} ${url}，${Math.round(wait)}ms 后重试 (${attempt + 1}/${retries})`);
      await sleep(wait);
    } catch (err) {
      // 非重试型 HTTP 错误直接抛出，避免被下面的通用重试逻辑吞掉再试一遍
      if (err instanceof HttpError && !isRetryableStatus(err.status)) {
        throw err;
      }
      lastErr = err;
      if (attempt >= retries) break;

      // 已经在上面为 429/503 sleep 过的情况：只有网络层错误才需要再 sleep
      if (!(err instanceof HttpError)) {
        const wait = backoffMs(attempt, retryDelayMs);
        await sleep(wait);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
