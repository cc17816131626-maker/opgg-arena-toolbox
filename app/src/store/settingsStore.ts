import { create } from "zustand";
import type { AppSettings } from "../types";
import { getSettings, saveSettings } from "../lib/tauri";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const defaultSettings: AppSettings = {
  autoUpdate: true,
  updateFrequency: "onLaunch",
  lastCheckedAt: null,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  load: async () => {
    const settings = await getSettings();
    set({ settings, loaded: true });
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await saveSettings(next);
  },
}));
