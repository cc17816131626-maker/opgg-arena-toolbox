import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolved: "dark" | "light";
  load: () => void;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "arena-theme-mode";

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

function applyTheme(resolved: "dark" | "light") {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("light", resolved === "light");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark",
  resolved: "dark",

  load: () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const mode: ThemeMode = saved === "light" || saved === "system" || saved === "dark" ? saved : "dark";
    const resolved = resolveMode(mode);
    applyTheme(resolved);
    set({ mode, resolved });

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (get().mode !== "system") return;
      const next = resolveMode("system");
      applyTheme(next);
      set({ resolved: next });
    };
    mq.addEventListener("change", onChange);
  },

  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    const resolved = resolveMode(mode);
    applyTheme(resolved);
    set({ mode, resolved });
  },
}));
