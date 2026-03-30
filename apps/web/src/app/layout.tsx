import type { Metadata } from "next";
import "./globals.css";
import SignOutButton from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import UserProfileSheet from "@/components/profile/UserProfileSheet";

export const metadata: Metadata = {
  title: "VITOGRAPH — Feed your cells, find balance",
  description:
    "Personal health tracker: medical results analysis and food diary.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="ru">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface-muted">
        {user && (
          <header className="bg-white border-b border-border px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between">
            <span className="font-bold text-lg tracking-tight text-ink">
              VITO<span className="text-primary-600">GRAPH</span>
            </span>
            <div className="flex items-center gap-4">
              <UserProfileSheet userId={user.id} userEmail={user.email || "User"} />
              <SignOutButton />
            </div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
