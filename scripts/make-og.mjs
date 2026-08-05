// Regenerates the share-card image (public/og.png, 1200x630) and the
// apple-touch icon (app/apple-icon.png, 180x180) from the logo assets.
// Run from Site/: node scripts/make-og.mjs   (sharp is a devDependency)
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- The wide wordmark, nested into a 1200x630 card ------------------------
const logo = (await readFile(join(SITE, "public/logo-wide.svg"), "utf8"))
  .replace(/<\?xml[^>]*\?>\s*/, "");

// Logo box: 940 wide at 1034.8:153.3 ratio -> ~139 tall, centered.
const LOGO_W = 940;
const LOGO_H = Math.round((LOGO_W * 153.3) / 1034.8);
const LOGO_X = (1200 - LOGO_W) / 2;
const LOGO_Y = 236;

const card = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <radialGradient id="ogGlow" cx="50%" cy="-8%" r="95%">
      <stop offset="0%" stop-color="#0076b6" stop-opacity="0.55"/>
      <stop offset="45%" stop-color="#0076b6" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#0076b6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ogRibbon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0076b6" stop-opacity="0"/>
      <stop offset="30%" stop-color="#38a8e8" stop-opacity="0.6"/>
      <stop offset="55%" stop-color="#aab2b8" stop-opacity="0.5"/>
      <stop offset="80%" stop-color="#0076b6" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0076b6" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#070b11"/>
  <rect width="1200" height="630" fill="url(#ogGlow)"/>

  ${Array.from({ length: 15 }, (_, i) => `<rect x="${i * 80 + 78}" y="0" width="2" height="630" fill="#ffffff" opacity="0.02"/>`).join("\n  ")}

  <rect x="0" y="0" width="1200" height="7" fill="url(#ogRibbon)"/>

  <svg x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_W}" height="${LOGO_H}" viewBox="0 0 1034.8 153.3">
    ${logo.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}
  </svg>

  <text x="600" y="452" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="26" font-weight="600" letter-spacing="11" fill="#78838d">THIS MUST BE THE POOL</text>

  <rect x="0" y="623" width="1200" height="7" fill="url(#ogRibbon)" opacity="0.6"/>
</svg>`;

await sharp(Buffer.from(card), { density: 144 })
  .resize(1200, 630)
  .png()
  .toFile(join(SITE, "public/og.png"));
console.log("wrote public/og.png");

// --- Apple touch icon from the app icon -------------------------------------
const icon = await readFile(join(SITE, "app/icon.svg"));
await sharp(icon, { density: 512 })
  .resize(180, 180)
  .png()
  .toFile(join(SITE, "app/apple-icon.png"));
console.log("wrote app/apple-icon.png");
