import { supabase } from "./supabaseClient";
import { makePollImagePath, uploadPollImage } from "./storageImages";

let migrationPromise = null;

function base64ToBlob(imageValue) {
  if (!imageValue) return null;
  if (/^https?:\/\//i.test(String(imageValue))) return null;

  const [header, payload] = String(imageValue).split(",");
  const base64 = payload || header;
  if (!base64) return null;

  const contentType = String(imageValue).startsWith("data:")
    ? header.match(/data:(.*?);base64/)?.[1] || "image/jpeg"
    : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

export async function migrateAllImages() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = runMigration();
  return migrationPromise;
}

async function runMigration() {
  console.log("Starting poll image migration...");

  const { data, error } = await supabase
    .from("poll_options")
    .select("id, poll_id, image, migrated")
    .not("image", "is", null)
    .or("migrated.is.null,migrated.eq.false");

  if (error) {
    console.error("Image migration could not load poll options:", error);
    return { migrated: 0, failed: 1, total: 0 };
  }

  const rows = data || [];
  let migrated = 0;
  let failed = 0;

  console.log(`Found ${rows.length} poll option image(s) to migrate.`);

  for (const row of rows) {
    try {
      const blob = base64ToBlob(row.image);

      if (!blob) {
        console.warn(`Skipping option ${row.id}: image is not base64 data.`);
        continue;
      }

      const path = makePollImagePath({
        pollId: row.poll_id,
        optionId: row.id,
      });
      const publicUrl = await uploadPollImage(blob, path);

      const { error: updateError } = await supabase
        .from("poll_options")
        .update({
          image_url: publicUrl,
          migrated: true,
        })
        .eq("id", row.id);

      if (updateError) throw updateError;

      migrated += 1;
      console.log(`Migrated ${migrated}/${rows.length}: option ${row.id}`);
    } catch (err) {
      failed += 1;
      console.error(`Failed migrating option ${row.id}:`, err);
    }
  }

  console.log(`Image migration complete. Migrated: ${migrated}. Failed: ${failed}.`);
  return { migrated, failed, total: rows.length };
}
