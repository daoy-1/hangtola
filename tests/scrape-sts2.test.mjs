import { describe, expect, it } from "vitest";
import { imageIdFromUrl } from "../scripts/scrape-sts2.mjs";

describe("STS2 scraper", () => {
  it("normalizes versioned composite image filenames to card ids", () => {
    expect(
      imageIdFromUrl("https://img.slaythespire2.gg/assets/cards-composite-v01/zh/dominate-ironclad-v01.webp?v=20260404-1"),
    ).toBe("dominate-ironclad");
  });
});
