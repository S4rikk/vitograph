"use client";

import React, { useEffect } from "react";

// Minimal Shadcn API-compatible Dialog wrapper
export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onPointerDown={(e) => {
                    // If the custom property does not prevent it, close on click outside
                    // We will handle this in DialogContent
                }}
            />
            {children}
        </div>
    );
}

export function DialogContent({
    children,
    onPointerDownOutside,
    onClose
}: {
    children: React.ReactNode;
    onPointerDownOutside?: (e: React.PointerEvent) => void;
    onClose?: () => void;
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
            {/* A distinct backdrop layer for capturing outside clicks */}
            <div
                className="fixed inset-0 z-[51]"
                onPointerDown={(e) => {
                    if (onPointerDownOutside) {
                        onPointerDownOutside(e);
                        if (e.defaultPrevented) return;
                    }
                    onClose?.();
                }}
            />
            <div className="relative z-[52] w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                <button
                    onClick={() => onClose?.()}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
    return <h2 className={`text-lg font-semibold leading-none tracking-tight ${className || ""}`} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={`text-sm text-ink-muted ${className || ""}`} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ""}`} {...props} />;
}
