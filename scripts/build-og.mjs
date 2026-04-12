#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(root, "static/brand/logo.svg");
const outPath = resolve(root, "static/brand/og-card.png");

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#0f172a";
const ACCENT = "#60a5fa";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const LOGO_SIZE = 260;

async function isStale() {
  try {
    const [logo, out] = await Promise.all([stat(logoPath), stat(outPath)]);
    return logo.mtimeMs > out.mtimeMs;
  } catch {
    return true;
  }
}

async function main() {
  if (!(await isStale())) {
    console.log("[og] og-card.png up to date");
    return;
  }

  const logoSvg = await readFile(logoPath);
  const logoPng = await sharp(logoSvg)
    .resize(LOGO_SIZE, LOGO_SIZE)
    .png()
    .toBuffer();

  const cardSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${BG}"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
      <text x="540" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="88" font-weight="700" fill="${TEXT}">BridgeLab</text>
      <text x="540" y="360" font-family="system-ui, -apple-system, sans-serif" font-size="34" fill="${MUTED}">Practice bridge bidding conventions.</text>
      <rect x="540" y="400" width="96" height="6" rx="3" fill="${ACCENT}"/>
    </svg>
  `);

  await mkdir(dirname(outPath), { recursive: true });
  await sharp(cardSvg)
    .composite([{ input: logoPng, left: 180, top: (HEIGHT - LOGO_SIZE) / 2 }])
    .png()
    .toFile(outPath);

  console.log(`[og] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
