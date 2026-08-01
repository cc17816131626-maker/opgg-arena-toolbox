/**
 * Next.js App Router 在 SSR 输出的 HTML 中会通过
 * `self.__next_f.push([1, "<chunk>"])` 把 React Server Components 的
 * "flight" 数据流式写入页面。每个 chunk 解码后是若干行，常见的几种行格式：
 *
 *   <id>:I[...]               模块引用（webpack 模块导入），跟数据无关
 *   <id>:T<hexLen>,<text>     原始文本流（按十六进制长度给出字节数），少见
 *   :HL[...] / :H<x>[...]     无 id 的 "Hint" 行（预加载提示），跟数据无关
 *   <id>:["$","div",k,props]  React 元素树
 *   <id>:{...} / <id>:[...]   普通 JSON 值（我们真正关心的业务数据通常长这样）
 *
 * 这里不依赖也不模拟 webpack/Next 运行时，只用纯文本扫描的方式把这些行还原成
 * `Map<chunkId, value>`；遇到不认识/解析失败的行会自动找下一行的起点重新同步，
 * 不会因为某一行特殊格式而让后面所有数据全部丢失。
 */

export interface FlightRow {
  id: string;
  /** "I" 表示模块引用行，"T" 表示原始文本行，其余为业务数据行 */
  kind?: "I" | "T";
  value: unknown;
}

const PUSH_CALL_RE = /self\.__next_f\.push\(\[1,(".*?")\]\)/gs;
const ROW_START_RE = /^([0-9a-zA-Z]*):/;

/** 从原始 HTML 中提取并拼接所有 flight chunk 的解码后文本 */
export function extractFlightText(html: string): string {
  let combined = "";
  for (const match of html.matchAll(PUSH_CALL_RE)) {
    const literal = match[1];
    try {
      combined += JSON.parse(literal) as string;
    } catch {
      // 极少数情况下字符串字面量无法直接 JSON.parse（例如被截断），跳过即可，
      // 不应让单个 chunk 的问题中断整体抓取。
    }
  }
  return combined;
}

class ParseCursor {
  i = 0;
  constructor(public text: string) {}

  get len() {
    return this.text.length;
  }

  skipWs() {
    const { text } = this;
    while (this.i < this.len) {
      const c = text[this.i];
      if (c === " " || c === "\t" || c === "\r" || c === "\n") this.i++;
      else break;
    }
  }

  parseString() {
    const { text } = this;
    this.i++; // opening quote
    while (this.i < this.len) {
      const c = text[this.i];
      if (c === "\\") {
        this.i += 2;
        continue;
      }
      if (c === '"') {
        this.i++;
        return;
      }
      this.i++;
    }
  }

  parseLiteral() {
    const m = /^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(this.text.slice(this.i));
    if (!m) throw new Error(`Unexpected token at ${this.i}: ${this.text.slice(this.i, this.i + 30)}`);
    this.i += m[0].length;
  }

  parseValue() {
    this.skipWs();
    const c = this.text[this.i];
    if (c === '"') return this.parseString();
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    return this.parseLiteral();
  }

  parseObject() {
    this.i++; // {
    this.skipWs();
    if (this.text[this.i] === "}") {
      this.i++;
      return;
    }
    while (true) {
      this.skipWs();
      this.parseString(); // key
      this.skipWs();
      if (this.text[this.i] !== ":") throw new Error(`Expected ':' at ${this.i}`);
      this.i++; // :
      this.parseValue();
      this.skipWs();
      if (this.text[this.i] === ",") {
        this.i++;
        continue;
      }
      if (this.text[this.i] === "}") {
        this.i++;
        return;
      }
      throw new Error(`Unexpected token in object at ${this.i}: ${this.text.slice(this.i, this.i + 30)}`);
    }
  }

  parseArray() {
    this.i++; // [
    this.skipWs();
    if (this.text[this.i] === "]") {
      this.i++;
      return;
    }
    while (true) {
      this.parseValue();
      this.skipWs();
      if (this.text[this.i] === ",") {
        this.i++;
        continue;
      }
      if (this.text[this.i] === "]") {
        this.i++;
        return;
      }
      throw new Error(`Unexpected token in array at ${this.i}: ${this.text.slice(this.i, this.i + 30)}`);
    }
  }
}

function findJsonValueEnd(text: string, start: number): number {
  const cursor = new ParseCursor(text);
  cursor.i = start;
  cursor.parseValue();
  return cursor.i;
}

/** 从某个失效位置开始，找到下一行可能的 "<id>:" 起点，用于自动跳过无法识别的行 */
function resyncToNextRow(text: string, from: number): number {
  let idx = from;
  while (idx < text.length) {
    const nl = text.indexOf("\n", idx);
    if (nl === -1) return text.length;
    const after = nl + 1;
    if (ROW_START_RE.test(text.slice(after, after + 16))) return after;
    idx = after;
  }
  return text.length;
}

/** 把整段 flight 文本拆分成若干 `{id, value}` 行 */
export function splitFlightRows(text: string): FlightRow[] {
  const rows: FlightRow[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    while (i < len && (text[i] === "\n" || text[i] === "\r")) i++;
    if (i >= len) break;

    const m = ROW_START_RE.exec(text.slice(i, i + 16));
    if (!m) {
      i = resyncToNextRow(text, i);
      continue;
    }

    const id = m[1];
    let pos = i + m[0].length;

    if (id === "") {
      // 无 id 的 Hint 行（预加载提示等），不含业务数据，直接跳过这一整行
      const nl = text.indexOf("\n", pos);
      i = nl === -1 ? len : nl + 1;
      continue;
    }

    try {
      const tag = text[pos];

      if (tag === "I") {
        const end = findJsonValueEnd(text, pos + 1);
        rows.push({ id, kind: "I", value: safeJsonParse(text.slice(pos + 1, end)) });
        i = end;
        continue;
      }

      if (tag === "T") {
        const m2 = /^T([0-9a-f]+),/.exec(text.slice(pos, pos + 32));
        if (!m2) throw new Error("bad T row header");
        const textLen = parseInt(m2[1], 16);
        const textStart = pos + m2[0].length;
        const end = Math.min(textStart + textLen, len);
        rows.push({ id, kind: "T", value: text.slice(textStart, end) });
        i = end;
        continue;
      }

      const end = findJsonValueEnd(text, pos);
      rows.push({ id, value: safeJsonParse(text.slice(pos, end)) });
      i = end;
    } catch {
      i = resyncToNextRow(text, pos);
    }
  }

  return rows;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** 一步到位：HTML -> chunkId -> 原始（未解引用）值 */
export function parseFlightChunks(html: string): Map<string, unknown> {
  const text = extractFlightText(html);
  const rows = splitFlightRows(text);
  const map = new Map<string, unknown>();
  for (const row of rows) {
    if (row.kind === "I" || row.kind === "T") continue; // 模块引用 / 原始文本行，不含业务数据
    map.set(row.id, row.value);
  }
  return map;
}
