"use client";

import { useState, useEffect, useRef } from "react";

interface UseAnimatedCounterOptions {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function useAnimatedCounter({
  end,
  duration = 1500,
  decimals = 0,
  prefix = "",
  suffix = "",
}: UseAnimatedCounterOptions) {
  const [displayValue, setDisplayValue] = useState<string>(
    `${prefix}0${suffix}`
  );
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          let startTimestamp: number | null = null;

          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Ease out cubic
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = easeOutProgress * end;

            const formattedNumber = currentValue.toLocaleString("en-US", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            });

            setDisplayValue(`${prefix}${formattedNumber}${suffix}`);

            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };

          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.2 }
    );

    const currentElem = elementRef.current;
    if (currentElem) {
      observer.observe(currentElem);
    }

    return () => {
      if (currentElem) observer.unobserve(currentElem);
    };
  }, [end, duration, decimals, prefix, suffix]);

  return { displayValue, elementRef };
}
