"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroAnimationProps {
  onComplete: () => void;
}

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_CUBIC = [0.65, 0, 0.35, 1] as const;

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  // Animation step tracker (1 to 7)
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    // Step 1: Wait 150ms
    const t1 = setTimeout(() => setStep(2), 150);

    // Step 2: Logo scales in (650ms) -> Ends at t = 800ms
    // Step 3: Pause 250ms -> Ends at t = 1050ms
    const t2 = setTimeout(() => setStep(4), 1050);

    // Step 4: Assembly slide out (700ms) -> Ends at t = 1750ms
    // Step 5: Pause 400ms -> Ends at t = 2150ms
    const t3 = setTimeout(() => setStep(6), 2150);

    // Step 6: Hero emphasis scale (450ms) -> Ends at t = 2600ms
    const t4 = setTimeout(() => setStep(7), 2600);

    // Step 7: Fade away reveal (600ms) -> Ends at t = 3200ms
    const t5 = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={step === 7 ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_EXPO }}
      className="fixed inset-0 z-[9999] bg-[#0B0D13] flex items-center justify-center overflow-hidden select-none pointer-events-none font-sans"
    >
      {/* Subtle Institutional Blue Ambient Glow (Keynote Style) */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Main Assembled Brand Container */}
      <motion.div
        animate={
          step === 6
            ? { scale: 1.08 }
            : step === 7
            ? { scale: 1.18, opacity: 0 }
            : { scale: 1 }
        }
        transition={{
          duration: step === 6 ? 0.45 : step === 7 ? 0.6 : 0.4,
          ease: EASE_EXPO,
        }}
        className="relative flex items-center justify-center max-w-[90vw] sm:max-w-none"
      >
        {/* TF Icon Container */}
        <motion.div
          initial={{ scale: 0.15, opacity: 0, x: 0 }}
          animate={{
            scale: step >= 2 ? 1 : 0.15,
            opacity: step >= 2 ? 1 : 0,
            x: step >= 4 ? -8 : 0, // Slight left offset when wordmark appears
          }}
          transition={{
            scale: { duration: 0.65, ease: EASE_EXPO },
            opacity: { duration: 0.5, ease: "easeOut" },
            x: { duration: 0.7, ease: EASE_CUBIC },
          }}
          className="relative shrink-0 z-20 flex items-center justify-center"
        >
          {/* Focused Blue Icon Glow */}
          <div className="absolute -inset-4 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />

          {/* Official TF Icon Asset */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_icon.png"
            alt="TradeFourge Icon"
            className="w-24 sm:w-32 md:w-36 h-auto object-contain drop-shadow-2xl"
          />
        </motion.div>

        {/* TradeFourge Wordmark (Reveals Left -> Right from behind Icon) */}
        <AnimatePresence>
          {step >= 4 && (
            <motion.div
              initial={{
                opacity: 0,
                x: -60,
                clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)",
              }}
              animate={{
                opacity: 1,
                x: 0,
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
              }}
              transition={{
                duration: 0.7,
                ease: EASE_CUBIC,
              }}
              className="relative z-10 shrink-0 ml-3 sm:ml-5 md:ml-6"
            >
              {/* Official TradeFourge Wordmark Asset */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo_wordmark.png"
                alt="TradeFourge Wordmark"
                className="h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-xl"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
