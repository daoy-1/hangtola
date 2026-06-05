import type { Card, RankingState } from "./types";

const boardWidth = 1800;
const labelWidth = 150;
const border = 3;
const padding = 14;
const gap = 10;
const cardWidth = 116;
const cardHeight = 148;
const minRowHeight = 168;

function getCssColor(name: string) {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue(name).trim();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("未能生成 PNG Blob"));
    }, "image/png");
  });
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = "";

  for (const char of chars) {
    const next = current + char;
    if (current && ctx.measureText(next).width > width) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  const totalHeight = lines.length * lineHeight;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y - totalHeight / 2 + lineHeight * (index + 0.72));
  });
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function loadImage(card: Card) {
  const image = new Image();
  image.decoding = "async";
  let timeoutId = 0;
  const loadPromise = new Promise<void>((resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`卡图加载超时：${card.name}`)), 10_000);
    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error(`无法加载卡图：${card.name}`));
    };
  });
  image.src = card.imagePath;

  if (image.complete && image.naturalWidth > 0) {
    window.clearTimeout(timeoutId);
    return image;
  }

  await loadPromise;
  return image;
}

export async function exportRankingPngBlob(state: RankingState, cardsById: Map<string, Card>) {
  const contentWidth = boardWidth - labelWidth;
  const columns = Math.max(1, Math.floor((contentWidth - padding * 2 + gap) / (cardWidth + gap)));
  const rowHeights = state.tiers.map((tier) => {
    const rows = Math.max(1, Math.ceil(tier.cardIds.length / columns));
    return Math.max(minRowHeight, padding * 2 + rows * cardHeight + (rows - 1) * gap);
  });
  const boardHeight = rowHeights.reduce((total, height) => total + height, 0);
  const canvas = document.createElement("canvas");
  canvas.width = boardWidth;
  canvas.height = boardHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("浏览器不支持 Canvas 导出");
  }

  const boardColor = getCssColor("--export-board") || "#1b2028";
  const borderColor = getCssColor("--export-border") || "#030508";
  ctx.fillStyle = boardColor;
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  let y = 0;
  for (const [tierIndex, tier] of state.tiers.entries()) {
    const rowHeight = rowHeights[tierIndex];
    ctx.fillStyle = tier.color;
    ctx.fillRect(0, y, labelWidth, rowHeight);

    ctx.fillStyle = "#06070a";
    ctx.font = "700 34px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawWrappedText(ctx, tier.label, labelWidth / 2, y + rowHeight / 2, labelWidth - 26, 40);

    ctx.fillStyle = borderColor;
    ctx.fillRect(labelWidth - border, y, border, rowHeight);
    if (tierIndex < state.tiers.length - 1) {
      ctx.fillRect(0, y + rowHeight - border, boardWidth, border);
    }

    const images = await Promise.all(
      tier.cardIds.map(async (cardId) => {
        const card = cardsById.get(cardId);
        return card ? [card, await loadImage(card)] as const : null;
      }),
    );

    images.forEach((entry, index) => {
      if (!entry) return;
      const [, image] = entry;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = labelWidth + padding + column * (cardWidth + gap);
      const cardY = y + padding + row * (cardHeight + gap);
      drawContainImage(ctx, image, x, cardY, cardWidth, cardHeight);
    });

    y += rowHeight;
  }

  return canvasToBlob(canvas);
}
