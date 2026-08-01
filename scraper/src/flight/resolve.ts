/**
 * React Flight 协议里，重复出现的子树会被替换成形如
 *   "$L4b"        -> 直接引用 chunk 4b 解析出的值（Lazy/Suspense 引用）
 *   "$4b"         -> 同上，无 L 前缀的等价引用
 *   "$55:props:skill_masteries:0:builds:0:skills" -> 引用 chunk 55 解析出的值，
 *                     再按路径逐级取属性（数字段当数组下标，"props" 对应
 *                     React 元素四元组 ["$", tag, key, props] 里下标 3 的 props）
 *   "$Sreact.fragment" -> Symbol 引用（React.Fragment），不是业务数据，原样保留
 *
 * resolveAll 会把整棵 chunk 树中的引用全部展开成真实值，方便后续直接
 * 用普通的对象/数组方式去查找业务数据，而不用关心 Flight 的内部表示。
 */

const REF_RE = /^\$(?:L)?([0-9a-zA-Z]+)(?::(.+))?$/;
const SYMBOL_RE = /^\$S/;

type Chunks = Map<string, unknown>;

function getByPath(root: unknown, path: string): unknown {
  if (path.length === 0) return root;
  const segments = path.split(":");
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur == null) return undefined;
    if (seg === "props" && Array.isArray(cur) && cur.length === 4 && cur[0] === "$") {
      cur = cur[3];
      continue;
    }
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isNaN(idx) ? undefined : cur[idx];
      continue;
    }
    if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[seg];
      continue;
    }
    return undefined;
  }
  return cur;
}

export function resolveAll(chunks: Chunks): Map<string, unknown> {
  const resolvedCache = new Map<string, unknown>();
  const resolving = new Set<string>();

  function resolveChunk(id: string): unknown {
    if (resolvedCache.has(id)) return resolvedCache.get(id);
    if (resolving.has(id)) return undefined; // 循环引用保护，返回 undefined 而不是死循环
    if (!chunks.has(id)) return undefined;

    resolving.add(id);
    const raw = chunks.get(id);
    const resolved = resolveValue(raw);
    resolving.delete(id);
    resolvedCache.set(id, resolved);
    return resolved;
  }

  function resolveValue(value: unknown): unknown {
    if (typeof value === "string") {
      if (SYMBOL_RE.test(value)) return value;
      const m = REF_RE.exec(value);
      if (m) {
        const [, refId, path] = m;
        const target = resolveChunk(refId);
        return path ? getByPath(target, path) : target;
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((v) => resolveValue(v));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = resolveValue(v);
      }
      return out;
    }
    return value;
  }

  for (const id of chunks.keys()) {
    resolveChunk(id);
  }

  return resolvedCache;
}
