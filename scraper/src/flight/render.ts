/**
 * 部分页面区块（典型如英雄详情页的“出装”Tab）没有把数据单独以干净 JSON 的
 * 形式传给客户端组件，而是直接把渲染好的 React 元素树（`["$", tag, key, props]`
 * 四元组）发下来，文本数据只存在于最终渲染出的表格文字里。
 *
 * 这里实现一个极简的“伪 DOM 渲染器”，把已解引用的 Flight 节点还原成 HTML
 * 字符串，再交给 cheerio 当成普通网页解析，这样不需要真的跑一个浏览器。
 */

const VOID_TAGS = new Set(["img", "br", "hr", "input", "col"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderChildren(children: unknown): string {
  // 注意：单个 React 元素的 children 也可能直接是一个四元组
  // ["$", tag, key, props]（而不是“多个子节点组成的数组”），
  // 这两种情况都交给 renderNode 处理，它内部会先判断是不是四元组，
  // 不是的话才会当成子节点列表逐个渲染——不能在这里先入为主地当数组展开，
  // 否则会把四元组拆成 "$" / tag / key / props 四段分别渲染，拼出 "$div" 这种乱码。
  return renderNode(children);
}

function attrsToHtml(props: Record<string, unknown>): string {
  const attrs: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "dangerouslySetInnerHTML") continue;
    if (value == null || typeof value === "function" || typeof value === "object") continue;
    let attrName = key;
    if (key === "className") attrName = "class";
    else if (key === "htmlFor") attrName = "for";
    else if (key.startsWith("meta") || key.startsWith("data")) {
      attrName = `data-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    }
    attrs.push(`${attrName}="${escapeHtml(String(value))}"`);
  }
  return attrs.length ? " " + attrs.join(" ") : "";
}

/** 把一个已解引用的 Flight 节点渲染成 HTML 字符串 */
export function renderNode(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeHtml(node);
  if (typeof node === "number") return String(node);

  if (Array.isArray(node)) {
    // React 元素四元组：["$", tag, key, props]
    if (node.length === 4 && node[0] === "$") {
      const tag = node[1];
      const key = node[2];
      const props = (node[3] as Record<string, unknown>) ?? {};
      // React 的 key 本身不是真实 DOM 属性，浏览器渲染结果里看不到它；
      // 但站点经常把行的业务 id（如 "boots_0"/"core_items_0"）放在 key 上，
      // 所以这里把它转存成 data-key，方便后面用普通的 CSS 选择器去定位行。
      const keyAttr = typeof key === "string" && key.length > 0 ? ` data-key="${escapeHtml(key)}"` : "";

      if (typeof tag !== "string" || tag.startsWith("$")) {
        // 自定义客户端组件引用（对应的 "I" 模块引用行没有被保留，因为那只是
        // webpack 模块信息，不是业务数据）。我们不知道它具体是什么组件，
        // 但它身上的 props（比如 metaType/metaId）往往就是我们要的数据，
        // 所以用一个通用的 <span> 包一层，把这些 props 转成 data-* 属性，
        // 而不是直接丢弃 tag 只渲染 children。
        return `<span${keyAttr}${attrsToHtml(props)}>${renderChildren(props.children)}</span>`;
      }

      if (VOID_TAGS.has(tag)) {
        return `<${tag}${keyAttr}${attrsToHtml(props)}/>`;
      }
      return `<${tag}${keyAttr}${attrsToHtml(props)}>${renderChildren(props.children)}</${tag}>`;
    }
    // 普通数组（children 列表）
    return node.map((n) => renderNode(n)).join("");
  }

  if (typeof node === "object") {
    // 不是 React 元素元组的普通对象，没有渲染语义，忽略
    return "";
  }

  return "";
}

/** 把一组已解引用的 chunk values 全部渲染拼接成一个 HTML 文档，方便整体用 cheerio 查询 */
export function renderChunksToHtml(values: Iterable<unknown>): string {
  let html = "";
  for (const v of values) {
    try {
      html += renderNode(v);
    } catch {
      // 单个区块渲染失败不应影响其余区块
    }
  }
  return `<div id="flight-root">${html}</div>`;
}
