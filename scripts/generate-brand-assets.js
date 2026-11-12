#!/usr/bin/env node
/*
 * Cuts every logo / icon file the app uses out of the master logo (design/physiq-logo.png),
 * using a headless browser's canvas, so no image library is needed:
 *
 *   node scripts/generate-brand-assets.js          (every file)
 *   node scripts/generate-brand-assets.js icon     (only the files whose path contains "icon")
 *
 * Writes public/brand/logo.webp (login hero), public/brand/mark.png (the Q on its own),
 * the PWA icons in public/icons/, and the favicon / Apple touch icon in src/app/.
 * Set PW_EXECUTABLE to use an installed Chrome or Edge instead of Playwright's Chromium.
 *
 * Not made here: public/brand/coach.webp and coach-face.webp, Q the coach who guides the app
 * tour. They come from design/coach-poster.png: the character cut out of the poster (rembg,
 * u2net_human_seg model) is design/coach-cutout.png, scaled to 480 px wide; the face icon is
 * a square crop of it on black, 128 px.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'design', 'physiq-logo.png');

// Source pixel squares: the whole logo, and the Q + athlete without the wordmark
// (the mark spans x 246-1033, y 128-865; the wordmark starts at y 895)
const FULL = { x: 0, y: 0, size: 1254 };
const MARK = { x: 240, y: 90, size: 800 };

// pad = empty border as a share of the output; maskable icons keep the mark inside the safe zone
const OUTPUTS = [
  { file: 'public/brand/logo.webp', mime: 'image/webp', size: 720, crop: FULL },
  { file: 'public/brand/mark.png', mime: 'image/png', size: 256, crop: MARK },
  { file: 'public/icons/icon-192.png', mime: 'image/png', size: 192, crop: MARK, pad: 0.06 },
  { file: 'public/icons/icon-512.png', mime: 'image/png', size: 512, crop: MARK, pad: 0.06 },
  { file: 'public/icons/maskable-512.png', mime: 'image/png', size: 512, crop: MARK, pad: 0.17 },
  { file: 'src/app/apple-icon.png', mime: 'image/png', size: 180, crop: MARK, pad: 0.08 },
  { file: 'src/app/icon.png', mime: 'image/png', size: 64, crop: MARK, pad: 0.02 },
];

const PAGE = `<!doctype html><meta charset="utf-8"><img id="src" src="/logo.png">`;

async function main() {
  const server = http
    .createServer((req, res) => {
      if (req.url === '/logo.png') return res.writeHead(200, { 'Content-Type': 'image/png' }).end(fs.readFileSync(SOURCE));
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE);
    })
    .listen(0);
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => document.getElementById('src').complete);
    const only = process.argv[2];
    for (const out of OUTPUTS.filter((o) => !only || o.file.includes(only))) {
      const dataUrl = await page.evaluate(({ size, crop, pad = 0, mime }) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        const inner = size * (1 - 2 * pad);
        ctx.drawImage(document.getElementById('src'), crop.x, crop.y, crop.size, crop.size, size * pad, size * pad, inner, inner);
        return canvas.toDataURL(mime, 0.92);
      }, out);
      const target = path.join(ROOT, out.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(`  ✓ ${out.file} (${fs.statSync(target).size} bytes)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
