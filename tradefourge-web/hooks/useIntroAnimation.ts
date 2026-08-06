"use client";

import { useState, useEffect } from "react";

const SESSION_KEY = "tradefourge_intro_played";

export function useIntroAnimation() {
  const [shouldPlayIntro, setShouldPlayIntro] = useState<boolean>(false);
  const [isIntroComplete, setIsIntroComplete] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);

    // 1. Accessibility check: if user prefers reduced motion, skip intro
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // 2. Check sessionStorage: only play on first visit in browser session
    const hasPlayed = sessionStorage.getItem(SESSION_KEY);

    if (prefersReducedMotion || hasPlayed === "true") {
      setShouldPlayIntro(false);
      setIsIntroComplete(true);
    } else {
      setShouldPlayIntro(true);
      setIsIntroComplete(false);
      // Mark as played for the rest of this session
      try {
        sessionStorage.setItem(SESSION_KEY, "true");
      } catch (e) {
        // Fallback if storage fails
      }
    }
  }, []);

  const handleAnimationComplete = () => {
    setIsIntroComplete(true);
    setShouldPlayIntro(false);
  };

  return {
    isMounted,
    shouldPlayIntro,
    isIntroComplete,
    handleAnimationComplete,
  };
}
