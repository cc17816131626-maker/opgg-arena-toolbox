export interface ChampionSummary {
  id: number;
  key: string;
  name: string;
  imageUrl: string;
  tier: number;
  rank: number;
  winRate: number;
  pickRate: number;
}

export interface AverageStats {
  winRate: number;
  pickRate: number;
  banRate: number;
  firstPlace: number;
  avgPlace: number;
}

export type AugmentRarity = "silver" | "gold" | "prismatic";

export interface AugmentEntry {
  id: number;
  name: string;
  rarity: AugmentRarity;
  imageUrl: string;
  pickRate: number;
  /** 胜率，百分比 0-100 */
  winRate?: number;
  games: number;
  description: string;
}

export interface SkillBuild {
  order: string[];
  play: number;
  pickRate: number;
  winRate: number;
}

export interface SkillMastery {
  priorityOrder: string[];
  play: number;
  firstPlace: number;
  pickRate: number;
  builds: SkillBuild[];
}

export interface SynergyChampion {
  championId: number;
  championKey: string;
  championName: string;
  championImageUrl: string;
  opRank: number;
  play: number;
  win: number;
  winRate: number;
  firstPlace: number;
  pickRate: number;
  avgPlace: number;
}

export interface ArenaCombinationChampion {
  id: number;
  key: string;
  name: string;
  imageUrl: string;
  /** 旧数据包兼容字段（scraper 已 remap 为 imageUrl） */
  image_url?: string;
}

export interface ArenaCombination {
  championIds: number[];
  teammateChampionIds: number[];
  champions: ArenaCombinationChampion[];
  teammateChampions: ArenaCombinationChampion[];
  arenaFormat: string;
  combinationSize: number;
  play: number;
  win: number;
  winRate: number;
  firstPlaceRate: number;
  averagePlace: number;
  pickRate: number;
}

export interface ItemRef {
  itemId: number;
  name: string;
  imageUrl: string;
}

export interface ItemBuildEntry {
  items: ItemRef[];
  avgPlace?: number;
  firstPlaceRate?: number;
  pickRate?: number;
  winRate?: number;
  games?: number;
}

export interface ChampionBuild {
  starterItems: ItemBuildEntry[];
  boots: ItemBuildEntry[];
  coreBuilds: ItemBuildEntry[];
  prismItems: ItemBuildEntry[];
  /** 「最终出装」单件热门装备；旧数据包可能没有该字段 */
  finalItems?: ItemBuildEntry[];
}

export interface ChampionDetail {
  id: number;
  key: string;
  name: string;
  imageUrl: string;
  tier: number;
  rank: number;
  averageStats: AverageStats;
  augmentsByRarity: {
    silver: AugmentEntry[];
    gold: AugmentEntry[];
    prismatic: AugmentEntry[];
  };
  skillMasteries: SkillMastery[];
  duoSynergies: SynergyChampion[];
  trioCombinations: ArenaCombination[];
  build: ChampionBuild;
}

export interface ArenaDataBundle {
  schemaVersion: 1;
  patch: string;
  generatedAt: string;
  champions: ChampionSummary[];
  championDetails: Record<string, ChampionDetail>;
}

export interface Manifest {
  version: string;
  patch: string;
  generatedAt: string;
  dataUrl: string;
  sha256: string;
  sizeBytes: number;
}

export type UpdateFrequency = "onLaunch" | "every6Hours" | "daily" | "manual";

export interface AppSettings {
  autoUpdate: boolean;
  updateFrequency: UpdateFrequency;
  lastCheckedAt: string | null;
}

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
}
