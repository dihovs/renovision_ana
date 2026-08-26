import sharp from "sharp";

const SRC = "public/renovision-logo.png";
const OUT = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
const SIZE = 1024;

// The logo is the mark (blue house + green R + "renovision") with "ana" set
// BELOW it, outside the house. An app icon is a square read at about 60pt on a
// home screen, so the whole lockup would shrink the mark to nothing to make
// room for a word that would be an unreadable smudge anyway. The house is the
// bounded, recognisable half — that is what goes in.
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const rowHasInk = (y) => {
  for (let x = 0; x < width; x++) if (data[(y * width + x) * channels + 3] > 8) return true;
  return false;
};

// Walk down from the top through the mark, then find the transparent gutter
// that separates it from "ana". Detected rather than hard-coded, so a
// re-exported logo with different padding still crops correctly.
let y = 0;
while (y < height && !rowHasInk(y)) y++;
const top = y;
while (y < height && rowHasInk(y)) y++;
const markBottom = y; // first empty row after the house

const cropHeight = markBottom - top;
const colHasInk = (x) => {
  for (let yy = top; yy < markBottom; yy++) if (data[(yy * width + x) * channels + 3] > 8) return true;
  return false;
};
let left = 0;
while (left < width && !colHasInk(left)) left++;
let right = width - 1;
while (right > left && !colHasInk(right)) right--;
const cropWidth = right - left + 1;

// Apple masks the corners, so art pushed to the edge gets clipped. ~82% of the
// square keeps the whole house inside the rounded-rect safe area.
const inner = Math.round(SIZE * 0.82);

const mark = await sharp(SRC)
  .extract({ left, top, width: cropWidth, height: cropHeight })
  .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .toBuffer();

// FLATTENED onto white, with no alpha: App Store icons are rejected outright
// for carrying an alpha channel, and a transparent icon renders black on some
// surfaces.
await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([{ input: mark, gravity: "center" }])
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .removeAlpha()
  .png()
  .toFile(OUT);

const out = await sharp(OUT).metadata();
console.log(`cropped mark ${cropWidth}x${cropHeight} from ${width}x${height}`);
console.log(`wrote ${OUT} — ${out.width}x${out.height}, channels ${out.channels}, alpha ${out.hasAlpha}`);
