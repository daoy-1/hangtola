import { expect, test } from "@playwright/test";

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
