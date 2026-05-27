#!/usr/bin/env node
// Generuje favicon a apple-touch-icon z public/logo-fokus-tisk.png.
// Spuštění:  node scripts/generate-favicon.mjs
//
// Vstup je obdélníkové logo (1545×1151) — zarovnáváme ho do čtverce přes
// `fit: contain` s bílým pozadím, aby se obsah nezkreslil a text zůstal
// nejvíc čitelný i při malých velikostech.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE = resolve(ROOT, "public/logo-fokus-tisk.png");
const TARGETS = [
  { out: "app/icon.png", size: 32, pad: 0 },
  { out: "app/apple-icon.png", size: 180, pad: 18 },
  { out: "public/favicon-32x32.png", size: 32, pad: 0 },
  { out: "public/favicon-16x16.png", size: 16, pad: 0 },
  { out: "public/apple-touch-icon.png", size: 180, pad: 18 },
  { out: "public/icon-192.png", size: 192, pad: 18 },
  { out: "public/icon-512.png", size: 512, pad: 48 },
];

if (!existsSync(SOURCE)) {
  console.error(`[favicon] zdrojový soubor neexistuje: ${SOURCE}`);
  process.exit(1);
}

async function generateOne({ out, size, pad }) {
  const outPath = resolve(ROOT, out);
  mkdirSync(dirname(outPath), { recursive: true });

  const inner = size - pad * 2;
  const resized = await sharp(SOURCE)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, top: pad, left: pad }])
    .png()
    .toFile(outPath);

  console.log(`[favicon] ${out} (${size}×${size})`);
}

for (const t of TARGETS) {
  await generateOne(t);
}

console.log("[favicon] hotovo");
