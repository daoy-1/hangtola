import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import cards from "../src/data/sts2-ironclad-cards.generated.json";
import type { Card } from "../src/types";

describe("generated Ironclad data", () => {
  it("has required fields and local images when scraped data exists", () => {
    const generatedCards = cards as Card[];
    if (generatedCards.length === 0) {
      expect(generatedCards).toEqual([]);
      return;
    }

    expect(generatedCards.length).toBeGreaterThanOrEqual(70);
    for (const card of generatedCards) {
      expect(card.id).toMatch(/-ironclad$/);
      expect(card.name).toBeTruthy();
      expect(card.character).toBe("Ironclad");
      expect(card.rarity).toBeTruthy();
      expect(card.cardType).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.sourceUrl).toBe(`https://slaythespire2.gg/zh/cards/${card.id}`);
      expect(card.imagePath).toBe(`/assets/cards/sts2/ironclad/${card.id}.webp`);
      expect(existsSync(path.join(process.cwd(), "public", card.imagePath))).toBe(true);
    }
  });

  it("includes versioned Ironclad cards such as Dominate", () => {
    const generatedCards = cards as Card[];
    if (generatedCards.length === 0) {
      expect(generatedCards).toEqual([]);
      return;
    }

    expect(generatedCards).toContainEqual(
      expect.objectContaining({
        id: "dominate-ironclad",
        name: "主宰",
        cardType: "Skill",
        rarity: "Uncommon",
      }),
    );
  });
});
