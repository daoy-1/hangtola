import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const scriptPath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(scriptPath);
const rootDir = path.resolve(__dirname, "..");
const cardsPageUrl = "https://slaythespire2.gg/zh/cards";
const imageOutDir = path.join(rootDir, "public", "assets", "cards", "sts2", "ironclad");
const jsonOutPath = path.join(rootDir, "src", "data", "sts2-ironclad-cards.generated.json");
const fixturePath = path.join(rootDir, "src", "data", "sts2-ironclad-cards.generated.json");

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "cong-hang-dao-la/0.1 local personal scraper",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function imageIdFromUrl(src) {
  const url = new URL(src, "https://slaythespire2.gg");
  const filename = path.basename(url.pathname);
  return filename.replace(/\.webp$/i, "").replace(/-v\d+(?:\.\d+)?$/i, "");
}

function normalizeImageUrl(src) {
  return new URL(src, "https://slaythespire2.gg").toString();
}

function collectImageMeta(html) {
  const $ = cheerio.load(html);
  const imagesById = new Map();

  $("img[src*='cards-composite'][src$='.webp'], img[src*='cards-composite'][src*='.webp?']").each((_, element) => {
    const src = $(element).attr("src");
    if (!src) return;
    const id = imageIdFromUrl(src);
    if (!id.endsWith("-ironclad")) return;

    const cardShell = $(element)
      .parents("div")
      .filter((__, div) => {
        const classes = $(div).attr("class") ?? "";
        return classes.includes("rounded-lg") && classes.includes("bg-card");
      })
      .first();

    const version = cardShell.find("select option[selected]").first().text().trim() || "latest";
    imagesById.set(id, {
      imageUrl: normalizeImageUrl(src),
      version,
    });
  });

  $("link[rel='preload'][as='image'][href*='cards-composite'][href*='-ironclad.webp']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const id = imageIdFromUrl(href);
    if (!imagesById.has(id)) {
      imagesById.set(id, {
        imageUrl: normalizeImageUrl(href),
        version: "latest",
      });
    }
  });

  return imagesById;
}

function extractNextFlightText(html) {
  const chunks = [];
  const chunkPattern = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  let match;

  while ((match = chunkPattern.exec(html))) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`));
    } catch {
      continue;
    }
  }

  return chunks.join("");
}

function extractJsonObjects(text) {
  const objects = [];
  let index = 0;

  while ((index = text.indexOf('{"id":"', index)) !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let cursor = index; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
      } else if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end = cursor + 1;
          break;
        }
      }
    }

    if (end === -1) break;
    objects.push(text.slice(index, end));
    index = end;
  }

  return objects;
}

function parseCardObjects(html, imageMeta) {
  const flightText = extractNextFlightText(html);
  const cardObjects = [];
  const seen = new Set();

  for (const objectText of extractJsonObjects(flightText)) {
    let parsed;
    try {
      parsed = JSON.parse(objectText);
    } catch {
      continue;
    }

    if (
      parsed?.character !== "Ironclad" ||
      parsed.category !== "CARD" ||
      !imageMeta.has(parsed.id) ||
      seen.has(parsed.id)
    ) {
      continue;
    }

    seen.add(parsed.id);
    cardObjects.push(parsed);
  }

  return cardObjects;
}

function toAppCard(card, imageMeta) {
  const meta = imageMeta.get(card.id);
  const imageUrl = meta?.imageUrl ?? `https://img.slaythespire2.gg/assets/cards-composite/zh/${card.id}.webp`;

  return {
    id: card.id,
    name: card.name,
    character: "Ironclad",
    rarity: card.rarity ?? "Unknown",
    cardType: card.cardType ?? "Unknown",
    energy: typeof card.energy === "number" ? card.energy : null,
    description: card.description ?? "",
    imagePath: `/assets/cards/sts2/ironclad/${card.id}.webp`,
    sourceUrl: `https://slaythespire2.gg/zh/cards/${card.id}`,
    version: meta?.version ?? card.dataSource ?? "latest",
    sourceImageUrl: imageUrl,
  };
}

async function downloadImage(card) {
  const outPath = path.join(imageOutDir, `${card.id}.webp`);
  const response = await fetch(card.sourceImageUrl, {
    headers: {
      "User-Agent": "cong-hang-dao-la/0.1 local personal scraper",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${card.name} image: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`Downloaded image for ${card.name} is unexpectedly small`);
  }
  await writeFile(outPath, bytes);
}

async function scrape() {
  await mkdir(path.dirname(jsonOutPath), { recursive: true });
  await mkdir(imageOutDir, { recursive: true });

  const html = await fetchText(cardsPageUrl);
  const imageMeta = collectImageMeta(html);
  const cards = parseCardObjects(html, imageMeta)
    .map((card) => toAppCard(card, imageMeta))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans"));

  if (cards.length < 70) {
    throw new Error(`Only parsed ${cards.length} Ironclad cards. The source page structure may have changed.`);
  }

  const battleTrance = cards.find((card) => card.id === "battle-trance-ironclad");
  if (!battleTrance || battleTrance.name !== "战斗专注" || !battleTrance.description.includes("抽3张牌")) {
    throw new Error("Battle Trance sanity check failed. Parsed data does not match the expected source page.");
  }

  for (const card of cards) {
    await downloadImage(card);
  }

  const generatedAt = new Date().toISOString();
  const publicCards = cards.map(({ sourceImageUrl, ...card }) => card);
  await writeFile(jsonOutPath, `${JSON.stringify(publicCards, null, 2)}\n`);

  console.log(`Generated ${publicCards.length} Ironclad cards at ${jsonOutPath}`);
  console.log(`Downloaded images to ${imageOutDir}`);
  console.log(`Source: ${cardsPageUrl}`);
  console.log(`Generated at: ${generatedAt}`);
}

if (scriptPath === path.resolve(process.argv[1])) {
  scrape().catch(async (error) => {
    console.error(error.message);
    if (existsSync(fixturePath)) {
      const existing = await readFile(fixturePath, "utf8");
      console.error(`Existing generated data size: ${existing.length} bytes`);
    }
    process.exit(1);
  });
}
