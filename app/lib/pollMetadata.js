import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { supabase } from "./supabaseClient";

export const SITE_NAME = "Rogue Rank";
export const DEFAULT_IMAGE_PATH = "/RogueRank.jpeg";

export function getSiteUrl() {
  const requestHeaders = headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost || requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || "http";
  const requestUrl = host ? `${forwardedProto}://${host}` : "";
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    requestUrl ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  return withProtocol.replace(/\/+$/, "");
}

export function absoluteUrl(value) {
  if (!value) return `${getSiteUrl()}${DEFAULT_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;

  const path = value.startsWith("/") ? value : `/${value}`;
  return `${getSiteUrl()}${path}`;
}

export function getPollThumbnail(poll) {
  if (poll?.thumbnail) return poll.thumbnail;

  const topOptionWithImage = (poll?.options || [])
    .filter((option) => option.image)
    .sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.votes || 0) - (a.votes || 0);
    })[0];

  return topOptionWithImage?.image || DEFAULT_IMAGE_PATH;
}

function normalizePoll(row) {
  if (!row) return null;

  const options = (row.poll_options || []).map((option) => ({
    id: option.id,
    text: option.text,
    image: option.image_url ?? option.image,
    rating: option.rating ?? 1000,
    votes: option.votes ?? 0,
  }));

  return {
    id: row.id,
    title: row.title || SITE_NAME,
    total_votes:
      row.total_votes ??
      options.reduce((sum, option) => sum + (option.votes || 0), 0),
    thumbnail: row.thumbnail || null,
    options,
  };
}

export async function getPollForMetadata(id) {
  if (!id) return null;

  noStore();

  const { data, error } = await supabase
    .from("polls")
    .select("id, title, total_votes, thumbnail, poll_options (id, text, image_url, rating, votes)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed loading poll metadata:", error);
    return null;
  }

  return normalizePoll(data);
}

export function formatCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
