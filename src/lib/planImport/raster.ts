import sharp from "sharp";
import type { Mask } from "./geometry";

/**
 * One picture of a plan, resized ONCE and used for both halves of the
 * import: the copy the model reads and the ink mask the walls are snapped
 * to. They have to be the same pixels, or the model's coordinates and the
 * snapping disagree by whatever the resize did.
 *
 * Sized to about 1.1 megapixels and at most 1568 px on the long side — the
 * most the vision model takes in without downscaling it again itself. A
 * small plan is enlarged to that, which matters: on a 575 px screenshot a
 * wall is three pixels and a label is six.
 */
export type PreparedPlan = { image: Buffer; mediaType: "image/png"; mask: Mask };

const TARGET_PIXELS = 1_100_000;
const LONG_EDGE = 1568;
/** Ink is anything darker than this after the contrast is stretched. */
const INK = 120;

export async function preparePlan(input: Buffer): Promise<PreparedPlan> {
  // Phone photos carry their rotation in EXIF; a PNG with transparency gets
  // a white sheet behind it so empty paper does not read as ink.
  const base = sharp(input, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 50 || height < 50) throw new Error("That image is too small to read as a plan.");

  const scale = Math.min(Math.sqrt(TARGET_PIXELS / (width * height)), LONG_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const resized = await base.resize(w, h, { kernel: "lanczos3" }).png().toBuffer();

  const grey = await sharp(resized).greyscale().normalise().raw().toBuffer({ resolveWithObject: true });
  const dark = new Uint8Array(grey.info.width * grey.info.height);
  for (let i = 0; i < dark.length; i++) dark[i] = grey.data[i] < INK ? 1 : 0;

  return {
    image: resized,
    mediaType: "image/png",
    mask: { width: grey.info.width, height: grey.info.height, dark },
  };
}
