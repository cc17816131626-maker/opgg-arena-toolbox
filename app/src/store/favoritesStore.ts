import { create } from "zustand";

interface FavoritesState {
  keys: string[];
  load: () => void;
  toggle: (key: string) => void;
  isFavorite: (key: string) => boolean;
}

const STORAGE_KEY = "arena-favorite-champions";

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  keys: [],

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      set({ keys: Array.isArray(parsed) ? parsed : [] });
    } catch {
      set({ keys: [] });
    }
  },

  toggle: (key) => {
    const current = get().keys;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [key, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ keys: next });
  },

  isFavorite: (key) => get().keys.includes(key),
}));
