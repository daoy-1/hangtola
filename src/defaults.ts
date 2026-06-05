import type { Tier } from "./types";

export const STORAGE_KEY = "cong-hang-dao-la:sts2-ironclad:v1";

export const defaultTiers: Tier[] = [
  { id: "hang", label: "夯", color: "#ff7379", cardIds: [] },
  { id: "top", label: "顶级", color: "#ffc078", cardIds: [] },
  { id: "ren-shang-ren", label: "人上人", color: "#ffe17d", cardIds: [] },
  { id: "npc", label: "NPC", color: "#f6ff65", cardIds: [] },
  { id: "la-wan-le", label: "拉完了", color: "#adff6b", cardIds: [] },
];

export const cardTypeLabels: Record<string, string> = {
  Attack: "攻击",
  Skill: "技能",
  Power: "能力",
  Status: "状态",
  Curse: "诅咒",
  Unknown: "未知",
};

export const rarityLabels: Record<string, string> = {
  Basic: "基础",
  Common: "普通",
  Uncommon: "罕见",
  Rare: "稀有",
  Special: "特殊",
  Unknown: "未知",
};
