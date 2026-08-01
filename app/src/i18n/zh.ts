/** 中文文案字典；后续接英文时按 key 扩展即可 */
export const zh = {
  appName: "斗魂竞技场",
  nav: {
    home: "首页",
    tierList: "强度榜",
    augments: "强化符文",
    compare: "对比",
    changelog: "版本变更",
    settings: "设置",
  },
  search: {
    placeholder: "搜索英雄…",
    shortcut: "⌘K",
    empty: "未找到匹配的英雄",
  },
  empty: {
    title: "暂无本地数据",
    description: "请前往「设置」页下载或导入最新数据包",
    action: "前往设置",
  },
  favorites: {
    title: "收藏英雄",
    empty: "点击英雄详情页的星标即可收藏",
  },
} as const;

export type MessageDict = typeof zh;
