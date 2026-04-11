import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl shadow-sm p-8 text-center animate-fade-in-up">
        <div className="mx-auto w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-ink mb-2">Access Denied</h1>
        <p className="text-ink-muted mb-8 text-sm leading-relaxed">
          You do not have the necessary permissions to access the administrator dashboard. 
          If you believe this is a mistake, please contact support.
        </p>
        
        <Link 
          href="/"
          className="inline-flex items-center justify-center gap-2 w-full bg-ink text-surface px-4 py-3 rounded-xl font-medium tracking-wide hover:bg-ink/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
