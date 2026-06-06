import { describe, expect, it } from "vitest";
import { addPngDpiMetadata, pixelsPerMeterForDpi } from "../src/exportBoard";

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

function writeUInt32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function makeMinimalPng() {
  const ihdr = new Uint8Array(25);
  writeUInt32(ihdr, 0, 13);
  ihdr.set([73, 72, 68, 82], 4);
  writeUInt32(ihdr, 8, 1);
  writeUInt32(ihdr, 12, 1);
  ihdr[16] = 8;
  ihdr[17] = 6;

  const iend = new Uint8Array(12);
  iend.set([73, 69, 78, 68], 4);

  return new Blob([new Uint8Array([...pngSignature, ...ihdr, ...iend])], { type: "image/png" });
}

async function findPhysChunk(blob: Blob) {
  const bytes = new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error("无法读取测试 PNG"));
      reader.readAsArrayBuffer(blob);
    }),
  );
  let offset = pngSignature.length;

  while (offset + 12 <= bytes.length) {
    const length =
      ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (type === "pHYs") {
      return bytes.slice(offset + 8, offset + 8 + length);
    }
    offset += 12 + length;
  }

  return null;
}

describe("PNG export metadata", () => {
  it("converts 300 DPI to PNG pixels-per-meter", () => {
    expect(pixelsPerMeterForDpi(300)).toBe(11811);
  });

  it("adds a 300 DPI pHYs chunk", async () => {
    const blob = await addPngDpiMetadata(makeMinimalPng(), 300);
    const phys = await findPhysChunk(blob);

    expect(phys).not.toBeNull();
    expect(Array.from(phys!.slice(0, 4))).toEqual([0, 0, 46, 35]);
    expect(Array.from(phys!.slice(4, 8))).toEqual([0, 0, 46, 35]);
    expect(phys![8]).toBe(1);
  });
});
