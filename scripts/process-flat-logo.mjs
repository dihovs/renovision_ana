import sharp from "sharp";

const SRC = process.argv[2];
const OUT = process.argv[3];

if (!SRC || !OUT) {
  console.error("Usage: node process-flat-logo.mjs <src> <out>");
  process.exit(1);
}

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const out = Buffer.alloc(width * height * 4);

// Flat artwork on a white background: alpha from distance-to-white,
// then unpremultiply against white so edge pixels keep their true hue.
const GAIN = 2.2;

for (let i = 0; i < width * height; i++) {
  const r = data[i * channels];
  const g = data[i * channels + 1];
  const b = data[i * channels + 2];

  const dist = Math.max(255 - r, 255 - g, 255 - b);
  const alpha = Math.min(255, Math.round(dist * GAIN));

  let nr = 255, ng = 255, nb = 255;
  if (alpha > 0) {
    nr = Math.max(0, Math.min(255, Math.round(255 - ((255 - r) * 255) / alpha)));
    ng = Math.max(0, Math.min(255, Math.round(255 - ((255 - g) * 255) / alpha)));
    nb = Math.max(0, Math.min(255, Math.round(255 - ((255 - b) * 255) / alpha)));
  }

  out[i * 4] = nr;
  out[i * 4 + 1] = ng;
  out[i * 4 + 2] = nb;
  out[i * 4 + 3] = alpha;
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .png()
  .trim({ threshold: 10 })
  .resize({ width: 640, withoutEnlargement: true })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`Wrote ${OUT} (${meta.width}x${meta.height})`);
