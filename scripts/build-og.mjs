/**
 * Rasterize public/og.svg to public/og.png (1200x630).
 *
 * Twitter, WhatsApp, iMessage, and older LinkedIn crawlers refuse
 * SVG for OG images; a raster PNG works everywhere. Committed
 * alongside the SVG so no build step is required for Vercel.
 * Regenerate whenever og.svg changes:
 *
 *   node scripts/build-og.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const inFile = path.join(root, "public", "og.svg");
const outFile = path.join(root, "public", "og.png");

const svg = readFileSync(inFile);

const png = await sharp(svg, { density: 300 })
  .resize(1200, 630, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(outFile, png);
console.log(`✓ wrote ${path.relative(root, outFile)}  (${(png.length / 1024).toFixed(1)} KB)`);
