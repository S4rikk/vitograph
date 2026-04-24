"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type FontScale = "small" | "medium" | "large";

interface FontScaleContextType {
  scale: FontScale;
  setScale: (scale: FontScale) => void;
}

const FontScaleContext = createContext<FontScaleContextType | undefined>(undefined);

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<FontScale>("medium");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount
    try {
      const storedScale = localStorage.getItem("vitograph-font-scale") as FontScale | null;
      if (storedScale && ["small", "medium", "large"].includes(storedScale)) {
        setScale(storedScale);
      }
    } catch (e) {
      console.error("Failed to read font scale from localStorage", e);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Apply font size
    const sizeMap: Record<FontScale, string> = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    
    document.documentElement.style.fontSize = sizeMap[scale];
    
    // Save to localStorage
    try {
      localStorage.setItem("vitograph-font-scale", scale);
    } catch (e) {
      console.error("Failed to save font scale to localStorage", e);
    }
  }, [scale, mounted]);

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale() {
  const context = useContext(FontScaleContext);
  if (context === undefined) {
    throw new Error("useFontScale must be used within a FontScaleProvider");
  }
  return context;
}
