import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientPage from "./ClientPage";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile to check if lifestyle_markers is populated
  const { data: profile } = await supabase
    .from("profiles")
    .select("lifestyle_markers")
    .eq("id", user.id)
    .single();

  const markers = profile?.lifestyle_markers as Record<string, any>;
  const needsOnboarding = !markers || Object.keys(markers).length === 0;

  return <ClientPage needsOnboarding={needsOnboarding} userId={user.id} />;
}
