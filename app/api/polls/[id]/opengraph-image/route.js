import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  absoluteUrl,
  DEFAULT_IMAGE_PATH,
  getPollForMetadata,
  getPollThumbnail,
} from "../../../../lib/pollMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function responseFromBuffer(buffer, contentType) {
  return new Response(buffer, {
    headers: {
      "Content-Type": contentType || "image/jpeg",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

function imageFromDataUrl(url) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(url || "");
  if (!match) return null;

  const [, contentType, isBase64, data] = match;
  const buffer = isBase64
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf8");

  return responseFromBuffer(buffer, contentType);
}

async function fallbackImage() {
  const logoPath = path.join(process.cwd(), "public", DEFAULT_IMAGE_PATH.replace(/^\//, ""));
  const buffer = await readFile(logoPath);
  return responseFromBuffer(buffer, "image/jpeg");
}

export async function GET(_request, { params }) {
  const poll = await getPollForMetadata(params?.id);
  const thumbnail = absoluteUrl(getPollThumbnail(poll));
  const dataUrlResponse = imageFromDataUrl(thumbnail);

  if (dataUrlResponse) return dataUrlResponse;

  if (/^https?:\/\//i.test(thumbnail)) {
    try {
      const imageResponse = await fetch(thumbnail, { cache: "no-store" });
      if (imageResponse.ok) {
        const buffer = await imageResponse.arrayBuffer();
        return responseFromBuffer(
          buffer,
          imageResponse.headers.get("content-type") || "image/jpeg"
        );
      }
    } catch (error) {
      console.error("Failed fetching poll Open Graph image:", error);
    }
  }

  return fallbackImage();
}
