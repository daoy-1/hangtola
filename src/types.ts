export interface Card {
  id: string;
  name: string;
  character: string;
  rarity: string;
  cardType: string;
  energy: number | null;
  description: string;
  imagePath: string;
  sourceUrl: string;
  version: string;
}

export interface Tier {
  id: string;
  label: string;
  color: string;
  cardIds: string[];
}

export interface RankingState {
  tiers: Tier[];
  unrankedCardIds: string[];
  updatedAt: string;
}

export type ContainerId = "unranked" | string;
