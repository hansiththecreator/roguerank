import { supabase } from "./supabaseClient";

export const POLL_IMAGES_BUCKET = "poll-images";

function sanitizePathPart(value) {
  return String(value || "image").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function makePollImagePath({ pollId, optionId } = {}) {
  const prefix =
    pollId && optionId
      ? `${sanitizePathPart(pollId)}-${sanitizePathPart(optionId)}`
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${Date.now()}.jpg`;
}

export async function uploadPollImage(fileOrBlob, path = makePollImagePath()) {
  if (!fileOrBlob) throw new Error("No image file was provided.");

  const { error } = await supabase.storage
    .from(POLL_IMAGES_BUCKET)
    .upload(path, fileOrBlob, {
      contentType: fileOrBlob.type || "image/jpeg",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(POLL_IMAGES_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not create a public image URL.");

  return data.publicUrl;
}
