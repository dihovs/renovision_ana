/**
 * Re-encodes an image through a canvas, which drops every metadata block —
 * EXIF, GPS, timestamps, device info — because canvas only carries pixels.
 *
 * Why this matters here: customers photograph damage with their phone, and a
 * phone photo normally embeds the GPS coordinates where it was taken. That is
 * the location of their home. Those photos get sent to Anthropic to judge
 * scope, so without this the coordinates leave the country attached to every
 * picture. Stripping in the browser means they never leave the device at all,
 * which is strictly better than stripping on the server.
 *
 * Downscaling is a second benefit rather than the point: the chat re-sends the
 * whole conversation (photos included) on every turn, so a 12 MP phone photo
 * is paid for repeatedly. 1568px on the long edge is Anthropic's guidance for
 * images — beyond it the image is downscaled server-side anyway, so the extra
 * bytes buy nothing.
 *
 * Fails closed. If re-encoding doesn't work we reject rather than falling back
 * to the original file, because the fallback would be silently sending the
 * coordinates we are trying to remove.
 */

const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

export async function stripImageMetadata(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available; refusing to send the original file.");

  // White base: transparent PNGs would otherwise flatten to black on JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  // A tainted canvas throws on export; a failed encode returns "data:,".
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Could not re-encode the image.");
  }
  return dataUrl;
}

/**
 * `createImageBitmap` honours EXIF orientation with imageOrientation set, so
 * rotation survives even though the tag itself does not. The <img> path is a
 * fallback for browsers without it.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path.
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image file."));
    };
    img.src = url;
  });
}
