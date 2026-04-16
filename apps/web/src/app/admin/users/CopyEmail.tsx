"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Renders a truncated email that copies to clipboard on click.
 * Shows a brief "Copied!" checkmark for 1.5s after clicking.
 */
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select text manually
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={`${email} — нажмите, чтобы скопировать`}
      className="group flex items-center gap-1.5 max-w-[200px] text-left"
    >
      <span className="truncate text-slate-200 font-medium group-hover:text-blue-300 transition-colors">
        {email}
      </span>
      <span className="shrink-0 text-slate-600 group-hover:text-blue-400 transition-colors">
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </span>
    </button>
  );
}
