import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console | VITOGRAPH",
  description: "Vitograph Administrator Console",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/login");
  }

  // Role check using app_metadata injected via JWT
  if (user.app_metadata?.role !== "admin") {
    redirect("/unauthorized");
  }

  // We explicitly apply the `.dark` class to force dark mode styles inside this sub-tree.
  return (
    <div className="dark antialiased bg-slate-950 text-slate-50 min-h-[100dvh] flex flex-col md:flex-row selection:bg-blue-500/30 selection:text-white font-sans">
      <AdminSidebar currentUserId={user.id} />
      
      <main className="flex-1 h-[100dvh] overflow-y-auto overflow-x-hidden relative w-full scroll-smooth">
        {/* Subtle premium glow effect behind main content */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10 lg:p-12 relative z-10 w-full min-h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
