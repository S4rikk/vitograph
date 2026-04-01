import { useState, useEffect, useRef } from 'react';

export function useTypewriter(rawText: string, speedMs: number = 10) {
  const [displayedText, setDisplayedText] = useState("");
  
  // Track the latest raw text without triggering re-renders of the effect
  const rawTextRef = useRef(rawText);

  useEffect(() => {
    rawTextRef.current = rawText;
    if (speedMs <= 0) {
      setDisplayedText(rawText);
    }
  }, [rawText, speedMs]);

  useEffect(() => {
    if (speedMs <= 0) return;

    // Create the interval EXACTLY ONCE.
    const interval = setInterval(() => {
      setDisplayedText((current) => {
        const currentRaw = rawTextRef.current;
        let i = current.length;
        
        if (i >= currentRaw.length) {
          return current; // Do nothing, wait for more text
        }

        const remainingText = currentRaw.substring(i);
        
        if (remainingText.startsWith("<")) {
          if (remainingText.startsWith("<n") || remainingText.startsWith("<m") || remainingText.startsWith("<t")) {
            const match = remainingText.match(/^(<nut[a-z]*[^>]*>[\s\S]*?<\/nut[a-z]*>|<meal_score[^>]*\/>|<think>[\s\S]*?<\/think>)/i);
            if (match) {
              return currentRaw.substring(0, i + match[0].length); // Instantly type full tag
            } else {
              return current; // Tag is incomplete over network, PAUSE
            }
          } else if (remainingText.length === 1 && i === currentRaw.length - 1) {
            return current; // Edge case: chunk ends exactly on '<', PAUSE
          } else {
            return currentRaw.substring(0, i + 1); // Normal mathematical '<'
          }
        }

        // Normal character typing
        return currentRaw.substring(0, i + 1);
      });
    }, speedMs);

    return () => clearInterval(interval);
  }, [speedMs]);

  return displayedText;
}
