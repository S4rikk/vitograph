"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Updates the status of a feedback entry.
 *
 * @param id - The primary key of the feedback record.
 * @param status - The new status value ("new" | "reviewed" | "resolved").
 */
export async function updateFeedbackStatus(
  id: number,
  status: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/feedback");
}
