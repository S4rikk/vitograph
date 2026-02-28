"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
    setLoading(false);
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm font-medium text-ink-muted hover:text-ink transition-colors"
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
