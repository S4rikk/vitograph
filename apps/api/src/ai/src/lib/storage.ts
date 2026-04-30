import { createClient } from "@supabase/supabase-js";

/**
 * Uploads a base64 image to Supabase Storage, registers TTL,
 * and returns the public URL of the uploaded image.
 */
export async function uploadNailPhoto(
  userId: string,
  base64Image: string,
  token: string
): Promise<string> {
  return uploadMediaFile(userId, base64Image, token, "nail_photos", 90); // 3 months
}

/**
 * Uploads a base64 image to Supabase Storage `food_photos` bucket,
 * registers TTL, and returns the public URL.
 */
export async function uploadFoodPhoto(
  userId: string,
  base64Image: string,
  token: string
): Promise<string> {
  return uploadMediaFile(userId, base64Image, token, "food_photos", 1); // 1 day
}

/**
 * Uploads a base64 image to Supabase Storage `tongue_photos` bucket,
 * registers TTL, and returns the public URL.
 */
export async function uploadTonguePhoto(
  userId: string,
  base64Image: string,
  token: string
): Promise<string> {
  return uploadMediaFile(userId, base64Image, token, "tongue_photos", 3); // 3 days
}

/**
 * Core generic upload function that registers a TTL for automated cleanup.
 */
async function uploadMediaFile(
  userId: string,
  base64Image: string,
  token: string,
  bucketName: string,
  ttlDays: number
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

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
    .from(bucketName)
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error(`[Storage] Upload failed for ${bucketName}:`, uploadError);
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  // 3. Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  const imageUrl = publicUrlData.publicUrl;

  // 4. Register for cleanup (TTL)
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const { error: insertError } = await supabase
      .from("media_cleanup")
      .insert({
        user_id: userId,
        file_path: fileName,
        bucket_name: bucketName,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error(`[Storage] Failed to register cleanup TTL for ${fileName}:`, insertError);
    }
  } catch (err) {
    console.warn(`[Storage] Non-fatal error during TTL registration:`, err);
  }

  return imageUrl;
}
