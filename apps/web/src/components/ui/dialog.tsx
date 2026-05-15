"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Enhanced Dialog component with Portal and Body Scroll Locking.
 * Fixes iOS Safari "jumping/bouncing" behavior when modals are opened inside scrollable containers.
 */
export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (open) {
            const originalStyle = window.getComputedStyle(document.body).overflow;
            // Prevent body scroll while modal is open
            document.body.style.overflow = "hidden";
            // iOS Safari fix for fixed elements inside scrollable containers
            document.body.style.touchAction = "none";
            
            return () => {
                document.body.style.overflow = originalStyle;
                document.body.style.touchAction = "";
            };
        }
    }, [open]);

    if (!mounted || !open) return null;

    // Use Portal to render at the end of body, isolating from parent scroll/transform contexts
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 outline-none touch-none overscroll-none">
            {children}
        </div>,
        document.body
    );
}

export function DialogContent({
    children,
    onPointerDownOutside,
    onClose,
    className
}: {
    children: React.ReactNode;
    onPointerDownOutside?: (e: React.PointerEvent) => void;
    onClose?: () => void;
    className?: string;
}) {

    // Close on Escape unless prevented
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <>
            {/* Backdrop layer - sibling to content to avoid click propagation issues */}
            <div
                className="fixed inset-0 z-[-1] bg-black/60 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
                onPointerDown={(e) => {
                    if (onPointerDownOutside) {
                        onPointerDownOutside(e);
                        if (e.defaultPrevented) return;
                    }
                    onClose?.();
                }}
            />
            
            <div className={`relative z-[10000] w-full max-w-lg rounded-3xl bg-surface p-6 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 animate-in fade-in zoom-in-95 duration-200 ${className || ""}`}>
                <button
                    onClick={() => onClose?.()}
                    className="absolute right-5 top-5 rounded-full p-2 opacity-50 transition-all hover:opacity-100 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:pointer-events-none"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                    <span className="sr-only">Close</span>
                </button>
                {children}
            </div>
        </>
    );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className || ""}`} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={`text-xl font-bold leading-none tracking-tight text-ink ${className || ""}`} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={`text-sm text-ink-muted leading-relaxed mt-2 ${className || ""}`} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 sm:gap-0 ${className || ""}`} {...props} />;
}

