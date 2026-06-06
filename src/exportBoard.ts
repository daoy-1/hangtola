import type { Card, RankingState } from "./types";

const boardWidth = 1800;
const exportDpi = 300;
const screenDpi = 96;
const exportScale = exportDpi / screenDpi;
const labelWidth = 150;
const border = 3;
const padding = 14;
const gap = 10;
const cardWidth = 116;
const cardHeight = 148;
const minRowHeight = 168;
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function getCssColor(name: string) {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue(name).trim();
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("未能生成 PNG Blob"));
    }, "image/png");
  });
  return addPngDpiMetadata(blob, exportDpi);
}

export function pixelsPerMeterForDpi(dpi: number) {
  return Math.round(dpi / 0.0254);
}

function writeUInt32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;

  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[index] = value >>> 0;
  }
  return crcTable;
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUInt32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  writeUInt32(chunk, 8 + data.length, crc32(crcInput));

  return chunk;
}

function makePhysChunk(dpi: number) {
  const pixelsPerMeter = pixelsPerMeterForDpi(dpi);
  const data = new Uint8Array(9);
  writeUInt32(data, 0, pixelsPerMeter);
  writeUInt32(data, 4, pixelsPerMeter);
  data[8] = 1;

  return makePngChunk("pHYs", data);
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function readBlobBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("无法读取 PNG Blob"));
    reader.readAsArrayBuffer(blob);
  });
}

export async function addPngDpiMetadata(blob: Blob, dpi: number) {
  const bytes = new Uint8Array(await readBlobBytes(blob));
  const signatureMatches = pngSignature.every((byte, index) => bytes[index] === byte);
  if (!signatureMatches) {
    return blob;
  }

  const parts: Uint8Array[] = [bytes.slice(0, pngSignature.length)];
  const physChunk = makePhysChunk(dpi);
  let offset: number = pngSignature.length;
  let inserted = false;

  while (offset + 12 <= bytes.length) {
    const length =
      ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return blob;

    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (type !== "pHYs") {
      parts.push(bytes.slice(offset, chunkEnd));
    }
    if (type === "IHDR" && !inserted) {
      parts.push(physChunk);
      inserted = true;
    }

    offset = chunkEnd;
  }

  if (!inserted) {
    return blob;
  }

  return new Blob([concatBytes(parts)], { type: "image/png" });
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
  canvas.width = Math.round(boardWidth * exportScale);
  canvas.height = Math.round(boardHeight * exportScale);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("浏览器不支持 Canvas 导出");
  }

  ctx.scale(exportScale, exportScale);
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
