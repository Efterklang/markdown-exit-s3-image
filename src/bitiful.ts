/**
 * Bitiful CDN integration utilities
 */
import { thumbHashToDataURL } from "thumbhash";
import sharp from "sharp";

/**
 * Check if URL belongs to Bitiful CDN.
 */
export function isBitifulDomain(
  url: string,
  bitifulDomains: string[],
): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    return bitifulDomains.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Fetch dimension info from Bitiful API.
 */
export async function getBitifulDimension(
  imageUrl: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const baseUrl = imageUrl.split("?")[0];
    const response = await fetch(`${baseUrl}?fmt=info`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      ImageWidth: number;
      ImageHeight: number;
    };
    const { ImageWidth: width, ImageHeight: height } = data;
    if (typeof width === "number" && typeof height === "number") {
      return { width, height };
    }
    return null;
  } catch (error) {
    console.warn(
      `[Bitiful] Dimension error for ${imageUrl}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Fetch thumbhash data URL from Bitiful API.
 */
export async function getBitifulThumbhash(
  imageUrl: string,
): Promise<string | null> {
  try {
    const baseUrl = imageUrl.split("?")[0];
    const response = await fetch(`${baseUrl}?fmt=thumbhash`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const base64String = await response.text();
    const thumbhashBytes = new Uint8Array(
      Buffer.from(base64String.trim(), "base64"),
    );
    const pngDataUrl = thumbHashToDataURL(thumbhashBytes);

    // Extract base64 data and remove the MIME prefix
    const base64Data = pngDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Convert PNG buffer to WebP
    const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

    // Encode back to base64 with new MIME type
    return `data:image/webp;base64,${webpBuffer.toString("base64")}`;
  } catch (error) {
    console.warn(
      `[Bitiful] Thumbhash error for ${imageUrl}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
