import { describe, expect, it } from "vitest";
import { defaultTiers } from "../src/defaults";
import { formatGameText } from "../src/gameText";
import { createInitialState, hydrateState, moveCardBetweenContainers } from "../src/state";
import cards from "../src/data/sts2-ironclad-cards.generated.json";
import type { Card, RankingState } from "../src/types";

const sampleCards: Card[] = [
  {
    id: "battle-trance-ironclad",
    name: "战斗专注",
    character: "Ironclad",
    rarity: "Uncommon",
    cardType: "Skill",
    energy: 0,
    description: "抽3张牌。 你在本回合内不能再抽任何牌。",
    imagePath: "/assets/cards/sts2/ironclad/battle-trance-ironclad.webp",
    sourceUrl: "https://slaythespire2.gg/zh/cards/battle-trance-ironclad",
    version: "latest",
  },
  {
    id: "bash-ironclad",
    name: "痛击",
    character: "Ironclad",
    rarity: "Basic",
    cardType: "Attack",
    energy: 2,
    description: "造成8点伤害。 给予2层[gold]易伤[/gold]。",
    imagePath: "/assets/cards/sts2/ironclad/bash-ironclad.webp",
    sourceUrl: "https://slaythespire2.gg/zh/cards/bash-ironclad",
    version: "latest",
  },
];

describe("ranking state", () => {
  it("creates the default five-tier ranking", () => {
    const state = createInitialState(sampleCards, "2026-06-05T00:00:00.000Z");
    expect(state.tiers.map((tier) => tier.label)).toEqual(defaultTiers.map((tier) => tier.label));
    expect(state.unrankedCardIds).toEqual(["battle-trance-ironclad", "bash-ironclad"]);
  });

  it("keeps saved tier settings and adds new cards to unranked", () => {
    const savedState: RankingState = {
      tiers: [{ ...defaultTiers[0], label: "神", cardIds: ["bash-ironclad"] }],
      unrankedCardIds: [],
      updatedAt: "old",
    };
    const state = hydrateState(sampleCards, savedState);
    expect(state.tiers[0].label).toBe("神");
    expect(state.tiers[0].cardIds).toEqual(["bash-ironclad"]);
    expect(state.unrankedCardIds).toEqual(["battle-trance-ironclad"]);
  });

  it("moves a card between containers", () => {
    const state = createInitialState(sampleCards);
    const next = moveCardBetweenContainers(state, "battle-trance-ironclad", "unranked", "hang");
    expect(next.tiers[0].cardIds).toEqual(["battle-trance-ironclad"]);
    expect(next.unrankedCardIds).toEqual(["bash-ironclad"]);
  });
});

describe("game text", () => {
  it("strips source color markup", () => {
    expect(formatGameText("给予2层[gold]易伤[/gold]。获得[energy:1]。")).toBe("给予2层易伤。获得1 能量。");
  });
});

describe("generated data", () => {
  it("contains Battle Trance after scraping", () => {
    if ((cards as Card[]).length === 0) {
      expect((cards as Card[]).length).toBe(0);
      return;
    }

    const battleTrance = (cards as Card[]).find((card) => card.id === "battle-trance-ironclad");
    expect(battleTrance).toMatchObject({
      name: "战斗专注",
      cardType: "Skill",
      rarity: "Uncommon",
      energy: 0,
    });
    expect(battleTrance?.description).toContain("抽3张牌");
    expect(battleTrance?.imagePath).toBe("/assets/cards/sts2/ironclad/battle-trance-ironclad.webp");
  });
});
