"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createKbDocument(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user?.app_metadata?.role !== "admin") {
    return { error: "Unauthorized: Admin access required." };
  }

  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const sourceMarkdown = formData.get("source_markdown") as string;
  
  if (!title || !category || !sourceMarkdown) {
    return { error: "All fields are required." };
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") + "-" + Date.now().toString(36);

  const { error } = await supabase
    .from("kb_documents")
    .insert({
      title,
      category,
      source_markdown: sourceMarkdown,
      slug,
      status: "pending"
    });

  if (error) {
    console.error("Failed to insert kb_document:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/knowledge");
  return { success: true };
}

export async function deleteKnowledgeDocument(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user?.app_metadata?.role !== "admin") {
    return { error: "Unauthorized: Admin access required." };
  }

  const { error } = await supabase
    .from("kb_documents")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete kb_document:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/knowledge");
  return { success: true };
}
