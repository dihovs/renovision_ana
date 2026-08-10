import sharp from "sharp";
import { mkdirSync } from "fs";

// App icons from the flat logo (640x743, transparent). White field, logo
// centred — Apple rounds the corners itself and dislikes alpha in app icons.
const LOGO = "public/renovision-logo.png";

async function icon(size, logoRatio, out) {
  const logoH = Math.round(size * logoRatio);
  const logo = await sharp(LOGO).resize({ height: logoH, fit: "inside" }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      {
        input: logo,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await icon(180, 0.72, "public/apple-touch-icon.png");
await icon(192, 0.72, "public/app-icon-192.png");
await icon(512, 0.72, "public/app-icon-512.png");
// Maskable: Android crops up to 20% per edge — keep the logo inside the safe zone.
await icon(512, 0.55, "public/app-icon-maskable-512.png");
// The iOS asset catalog's single universal icon.
mkdirSync("build-assets", { recursive: true });
await icon(1024, 0.72, "build-assets/ios-app-icon-1024.png");
