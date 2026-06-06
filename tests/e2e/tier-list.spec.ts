import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { defaultTiers, STORAGE_KEY } from "../../src/defaults";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsData = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../src/data/sts2-ironclad-cards.generated.json"), "utf8"),
) as Array<{ id: string }>;

test("ranks a card and exports the board", async ({ page }) => {
  await page.goto("/");

  const board = page.getByTestId("tier-board");
  await expect(board).toBeVisible();

  const firstCard = page.locator("[data-testid^='card-']").first();
  const firstTier = page.getByTestId("drop-hang");
  await expect(firstCard).toBeVisible();

  const cardBox = await firstCard.boundingBox();
  const tierBox = await firstTier.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(tierBox).not.toBeNull();

  await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(tierBox!.x + tierBox!.width / 2, tierBox!.y + tierBox!.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect(firstTier.locator("[data-testid^='card-']")).toHaveCount(1);
  await page.waitForTimeout(1000);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出图片/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/从夯到拉-铁甲战士-.+\.png/);
});

test("drops a card into a short lane between taller neighboring lanes", async ({ page }) => {
  const dragId = "dominate-ironclad";
  const rankedIds = cardsData.map((card) => card.id).filter((id) => id !== dragId);
  const state = {
    tiers: defaultTiers.map((tier, index) => ({
      ...tier,
      cardIds:
        index === 0
          ? rankedIds.slice(0, 24)
          : index === 2
            ? rankedIds.slice(24, 48)
            : index === 3
              ? rankedIds.slice(48, 68)
              : index === 4
                ? rankedIds.slice(68)
                : [],
    })),
    unrankedCardIds: [dragId],
    updatedAt: "2026-06-05T00:00:00.000Z",
  };

  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.addInitScript(
    ({ key, rankingState }) => {
      localStorage.setItem(key, JSON.stringify(rankingState));
    },
    { key: STORAGE_KEY, rankingState: state },
  );
  await page.goto("/");

  const source = page.getByTestId(`card-${dragId}`);
  const targetLane = page.getByTestId("drop-top");
  await expect(source).toBeVisible();
  await expect(targetLane).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await targetLane.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 16 });
  await page.mouse.up();

  await expect(targetLane.getByTestId(`card-${dragId}`)).toHaveCount(1);
});
