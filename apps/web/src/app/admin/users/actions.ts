"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Creates a new user via Supabase Auth Admin API.
 *
 * @param email - User's email address.
 * @param password - Initial password (min 6 chars).
 * @returns Object containing the new user's id.
 */
export async function createUser(
  email: string,
  password: string,
): Promise<{ id: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  return { id: data.user.id };
}

/**
 * Bans a user for ~100 years (effectively permanent).
 *
 * @param userId - The UUID of the user to ban.
 */
export async function banUser(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/**
 * Removes a ban from a previously banned user.
 *
 * @param userId - The UUID of the user to unban.
 */
export async function unbanUser(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "0s",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/**
 * Permanently deletes a user and all their associated data.
 *
 * @param userId - The UUID of the user to delete.
 */
export async function deleteUser(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
