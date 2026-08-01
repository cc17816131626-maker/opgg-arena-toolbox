import type { AppSettings, UpdateFrequency } from "../types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * 长驻运行期间是否到期该再检查一次。
 * `onLaunch` 只在启动时查，不走定时器；`manual` 永远不自动查。
 */
export function shouldCheckNow(settings: AppSettings, now = Date.now()): boolean {
  if (!settings.autoUpdate) return false;
  if (settings.updateFrequency === "manual" || settings.updateFrequency === "onLaunch") {
    return false;
  }
  if (!settings.lastCheckedAt) return true;

  const last = Date.parse(settings.lastCheckedAt);
  if (Number.isNaN(last)) return true;

  const elapsed = now - last;
  switch (settings.updateFrequency) {
    case "every6Hours":
      return elapsed >= 6 * HOUR_MS;
    case "daily":
      return elapsed >= DAY_MS;
    default: {
      const _exhaustive: never = settings.updateFrequency;
      return _exhaustive;
    }
  }
}

/** 启动时是否该立刻检查一次（仅手动模式 / 关闭自动更新时跳过） */
export function shouldCheckOnLaunch(settings: AppSettings): boolean {
  if (!settings.autoUpdate) return false;
  switch (settings.updateFrequency) {
    case "onLaunch":
      return true;
    case "every6Hours":
    case "daily":
      // 与定时轮询同一套到期逻辑：刚检查过就别在启动时再打一次
      return shouldCheckNow(settings);
    case "manual":
      return false;
    default: {
      const _exhaustive: never = settings.updateFrequency;
      return _exhaustive;
    }
  }
}

/** 轮询间隔：用于 setInterval。null 表示不需要定时器。 */
export function getPollIntervalMs(frequency: UpdateFrequency): number | null {
  switch (frequency) {
    case "every6Hours":
      // 不必真的睡满 6 小时才醒一次：每 10 分钟看一眼是否到期即可，避免错过窗口
      return 10 * 60 * 1000;
    case "daily":
      return 30 * 60 * 1000;
    case "onLaunch":
    case "manual":
      return null;
    default: {
      const _exhaustive: never = frequency;
      return _exhaustive;
    }
  }
}
