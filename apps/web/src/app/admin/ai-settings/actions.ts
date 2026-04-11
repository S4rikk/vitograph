"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getAppConfigKeys() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user?.app_metadata?.role !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  const { data, error } = await supabase
    .from("_app_config")
    .select("key, value")
    .order("key");

  if (error) {
    console.error("Failed to fetch app config:", error);
    throw new Error("Could not retrieve system configuration");
  }

  return data.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
}

export async function updateAppConfigItem(key: string, value: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user?.app_metadata?.role !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  // Attempt to upsert the config key
  const { error } = await supabase
    .from("_app_config")
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    console.error(`Failed to update config [${key}]:`, error);
    throw new Error(error.message);
  }

  // Refresh caching
  revalidatePath("/admin/ai-settings");
}
