/**
 * 在已解引用的 chunk 树里做“按形状查找”的小工具：
 * 因为我们不依赖也不还原完整的组件树结构，只关心某个具体页面区块带的数据，
 * 所以用“深度优先遍历 + 谓词匹配”来定位数据节点，对页面 DOM 结构调整更有韧性
 * （只要数据字段名不变，组件包裹层级怎么变都能找到）。
 */

export function deepFindAll(root: Iterable<unknown> | unknown, predicate: (node: unknown) => boolean, maxResults = Infinity): unknown[] {
  const results: unknown[] = [];
  const seen = new Set<unknown>();

  function visit(node: unknown) {
    if (results.length >= maxResults) return;
    if (node == null) return;
    if (typeof node === "object") {
      if (seen.has(node)) return;
      seen.add(node);
    }

    if (predicate(node)) {
      results.push(node);
      if (results.length >= maxResults) return;
    }

    if (Array.isArray(node)) {
      for (const child of node) visit(child);
    } else if (typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) visit(value);
    }
  }

  if (root && typeof (root as Iterable<unknown>)[Symbol.iterator] === "function" && !Array.isArray(root)) {
    for (const v of root as Iterable<unknown>) visit(v);
  } else {
    visit(root);
  }

  return results;
}

export function deepFind(root: Iterable<unknown> | unknown, predicate: (node: unknown) => boolean): unknown | undefined {
  return deepFindAll(root, predicate, 1)[0];
}

export function hasKeys(node: unknown, keys: string[]): node is Record<string, unknown> {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const rec = node as Record<string, unknown>;
  return keys.every((k) => k in rec);
}

export function isArrayOfObjectsWithKeys(node: unknown, keys: string[]): node is Record<string, unknown>[] {
  if (!Array.isArray(node) || node.length === 0) return false;
  return node.every((item) => hasKeys(item, keys));
}
