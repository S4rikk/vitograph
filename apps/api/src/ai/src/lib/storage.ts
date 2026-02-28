import { createClient } from "@supabase/supabase-js";

/**
 * Uploads a base64 image to Supabase Storage, keeps only the 10 most recent
 * photos per user, and returns the public URL of the uploaded image.
 */
export async function uploadAndRotateNailPhoto(
  userId: string,
  base64Image: string,
  token: string
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const BUCKET_NAME = "nail_photos";

  // 1. Process base64 string
  // Extract content type and the actual base64 data (e.g., "data:image/jpeg;base64,...")
  const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image format");
  }
  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  // 2. Upload the new photo
  const timestamp = Date.now();
  const fileExt = contentType.split("/")[1] || "jpg";
  const fileName = `${userId}/${timestamp}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[Storage] Upload failed:", uploadError);
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  // 3. Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  const imageUrl = publicUrlData.publicUrl;

  // 4. Rotate (Keep only 10 most recent)
  try {
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userId}/`, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      console.error("[Storage] Failed to list files for rotation:", listError);
    } else if (files && files.length > 10) {
      // Find files older than the 10th
      const filesToDelete = files.slice(10).map((f) => `${userId}/${f.name}`);
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filesToDelete);

        if (deleteError) {
          console.error("[Storage] Failed to delete old files:", deleteError);
        } else {
          console.log(`[Storage] Rotated out ${filesToDelete.length} old photos for user ${userId}`);
        }
      }
    }
  } catch (err) {
    // We don't want rotation failure to strictly fail the upload step
    console.warn("[Storage] Non-fatal error during rotation:", err);
  }

  return imageUrl;
}

/**
 * Uploads a base64 image to Supabase Storage `food_photos` bucket,
 * keeps only the 20 most recent photos per user, and returns the public URL.
 */
export async function uploadAndRotateFoodPhoto(
  userId: string,
  base64Image: string,
  token: string,
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const BUCKET_NAME = "food_photos";
  const MAX_PHOTOS = 20;

  // 1. Process base64 string
  const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image format");
  }
  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  // 2. Upload the new photo
  const timestamp = Date.now();
  const fileExt = contentType.split("/")[1] || "jpg";
  const fileName = `${userId}/${timestamp}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { contentType, upsert: true });

  if (uploadError) {
    console.error("[Storage] Food photo upload failed:", uploadError);
    throw new Error(`Failed to upload food photo: ${uploadError.message}`);
  }

  // 3. Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  const imageUrl = publicUrlData.publicUrl;

  // 4. Rotate (keep only MAX_PHOTOS most recent)
  try {
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userId}/`, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      console.error("[Storage] Failed to list food photos:", listError);
    } else if (files && files.length > MAX_PHOTOS) {
      const filesToDelete = files
        .slice(MAX_PHOTOS)
        .map((f) => `${userId}/${f.name}`);
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filesToDelete);

        if (deleteError) {
          console.error("[Storage] Failed to delete old food photos:", deleteError);
        } else {
          console.log(
            `[Storage] Rotated out ${filesToDelete.length} old food photos for user ${userId}`,
          );
        }
      }
    }
  } catch (err) {
    console.warn("[Storage] Non-fatal error during food photo rotation:", err);
  }

  return imageUrl;
}
