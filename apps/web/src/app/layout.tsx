import type { Metadata } from "next";
import "./globals.css";
import SignOutButton from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import UserProfileSheet from "@/components/profile/UserProfileSheet";
import Logo from "@/components/ui/Logo";
import { FontScaleProvider } from "@/components/providers/FontScaleProvider";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import LocaleSync from "@/components/providers/LocaleSync";
import ServerActionErrorListener from "@/components/providers/ServerActionErrorListener";


import { getTranslations } from 'next-intl/server';
import { Toaster } from "sonner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('title') + " — Feed your cells, find balance",
    description: t('subtitle'),
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await getLocale();
  const messages = await getMessages();

  let profileLocale = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .single();
    profileLocale = profile?.locale;
  }


  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              var scale = localStorage.getItem('vitograph-font-scale') || 'medium';
              var size = scale === 'small' ? '14px' : scale === 'large' ? '18px' : '16px';
              document.documentElement.style.fontSize = size;
            } catch (e) {}
          `
        }} />
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-[100dvh] flex flex-col bg-surface-muted sm:h-auto sm:min-h-screen sm:block transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <NextIntlClientProvider messages={messages}>
          <LocaleSync profileLocale={profileLocale} />
          <ServerActionErrorListener />

        <FontScaleProvider>
          {user && (
            <header className="shrink-0 bg-surface border-b border-border px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between shadow-sm relative z-50">
              <Logo size="sm" showSubtitle={false} />
              <div className="flex items-center gap-4">
                <UserProfileSheet userId={user.id} userEmail={user.email || "User"} />
                <SignOutButton />
              </div>
            </header>
          )}
          <main className="flex-1 flex flex-col min-h-0">{children}</main>
        </FontScaleProvider>
        </NextIntlClientProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
