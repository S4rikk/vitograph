"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registeredPassword, setRegisteredPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('auth');

  const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let randomPart = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const array = new Uint32Array(12);
      crypto.getRandomValues(array);
      for (let i = 0; i < 12; i++) {
        randomPart += chars[array[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 12; i++) {
        randomPart += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return `Vito-${randomPart}`;
  };

  // Handle Capacitor background session restoration
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/");
        router.refresh();
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/");
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isRegisterMode) {
      const generatedPassword = generateSecurePassword();
      const { error } = await supabase.auth.signUp({
        email,
        password: generatedPassword,
        options: {
          data: {
            temp_password: generatedPassword,
          }
        }
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        setRegisteredPassword(generatedPassword);
        setLoading(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Email not confirmed') {
          setError(t('emailNotConfirmed'));
        } else {
          setError(error.message);
        }
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    }
  };

  if (registeredPassword) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted p-4">
        <div className="w-full max-w-md space-y-8 rounded-2xl bg-surface/80 backdrop-blur-2xl border border-border/50 shadow-xl p-10 relative z-10 text-center">
          <h2 className="text-2xl font-extrabold text-ink">
            {t('registerSuccessTitle')}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t('registerSuccessDesc')}
          </p>
          <div className="mt-6 p-4 rounded-xl bg-surface-muted border border-border/50 text-xl font-mono tracking-wider break-all text-ink font-bold">
            {registeredPassword}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(registeredPassword);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-4 flex w-full justify-center rounded-md border border-border/50 bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted transition-colors"
          >
            {copied ? t('passwordCopied') : t('copyPassword')}
          </button>
          <div className="mt-6 space-y-3 px-2 text-balance">
            <p className="text-xs text-ink-muted/80 leading-relaxed">
              {t('registerWarning')}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium leading-relaxed bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
              {t('confirmEmailWarning')}
            </p>
          </div>
          <button
            onClick={() => {
              setRegisteredPassword(null);
              setIsRegisterMode(false);
              setPassword(registeredPassword);
            }}
            className="mt-6 flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            {t('backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-surface/80 backdrop-blur-2xl border border-border/50 dark:border-white/20 dark:shadow-[0_0_20px_rgba(255,255,255,0.1),inset_0_0_15px_rgba(255,255,255,0.05)] shadow-xl p-10 relative z-10">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-ink">
            {t('title')}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {isRegisterMode ? t('subtitleRegister') : t('subtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                {t('email')}
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`relative block w-full border border-border/50 bg-surface/50 px-3 py-3 text-ink placeholder-ink-muted focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm transition-colors ${isRegisterMode ? 'rounded-md' : 'rounded-t-md'}`}
                placeholder={t('email')}
              />
            </div>
            {!isRegisterMode && (
              <div>
                <label htmlFor="password" className="sr-only">
                  {t('password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="relative block w-full rounded-b-md border border-border/50 bg-surface/50 px-3 py-3 text-ink placeholder-ink-muted focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm transition-colors"
                  placeholder={t('password')}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isRegisterMode 
                ? (loading ? t('signingUp') : t('signUp')) 
                : (loading ? t('signingIn') : t('signIn'))}
            </button>
          </div>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError(null);
              }}
              className="text-sm text-primary-600 hover:text-primary-500 font-medium"
            >
              {isRegisterMode ? t('hasAccount') : t('noAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
