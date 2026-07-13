import sharp from "sharp";

const SRC = process.argv[2];
const OUT = process.argv[3];

if (!SRC || !OUT) {
  console.error("Usage: node process-logo.mjs <src> <out>");
  process.exit(1);
}

const image = sharp(SRC).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const out = Buffer.alloc(width * height * 4);

const THRESHOLD = 95; // below this, fully transparent (cuts the diffuse outer haze)
const GAMMA = 0.55; // <1 snaps mid-tones toward opaque for a crisper edge

for (let i = 0; i < width * height; i++) {
  const r = data[i * channels];
  const g = data[i * channels + 1];
  const b = data[i * channels + 2];

  // Unpremultiply assuming an additive glow blended onto a pure black
  // background: alpha = brightest channel, then rescale RGB back up.
  const rawAlpha = Math.max(r, g, b);

  let nr = 0, ng = 0, nb = 0;
  if (rawAlpha > 0) {
    nr = Math.min(255, Math.round((r * 255) / rawAlpha));
    ng = Math.min(255, Math.round((g * 255) / rawAlpha));
    nb = Math.min(255, Math.round((b * 255) / rawAlpha));
  }

  let alpha = 0;
  if (rawAlpha > THRESHOLD) {
    const t = (rawAlpha - THRESHOLD) / (255 - THRESHOLD);
    alpha = Math.round(255 * Math.pow(t, GAMMA));
  }

  out[i * 4] = nr;
  out[i * 4 + 1] = ng;
  out[i * 4 + 2] = nb;
  out[i * 4 + 3] = alpha;
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT} (${width}x${height})`);
