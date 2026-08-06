"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

interface IntroAnimationProps {
  onComplete: () => void;
}

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_CUBIC = [0.65, 0, 0.35, 1] as const;

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(0);
  const [assetsReady, setAssetsReady] = useState<boolean>(false);
  const { theme } = useTheme();
  const isLight = theme === "light";

  // Preload & decode theme images before initiating animation timeline
  useEffect(() => {
    let active = true;

    async function preloadAssets() {
      const urls = [
        "/logo_icon.png",
        "/logo_wordmark.png",
        "/logo_icon_light.png",
        "/logo_wordmark_light.png",
      ];
      try {
        await Promise.all(
          urls.map((url) => {
            return new Promise((resolve) => {
              const img = new Image();
              img.src = url;
              if (img.complete) {
                if ("decode" in img) {
                  img.decode().then(resolve).catch(resolve);
                } else {
                  resolve(true);
                }
              } else {
                img.onload = () => {
                  if ("decode" in img) {
                    img.decode().then(resolve).catch(resolve);
                  } else {
                    resolve(true);
                  }
                };
                img.onerror = () => resolve(true);
              }
            });
          })
        );
      } catch (e) {
        // Fallback
      }

      if (active) {
        setAssetsReady(true);
      }
    }

    preloadAssets();

    return () => {
      active = false;
    };
  }, []);

  // Animation timeline trigger once assets are decoded into GPU VRAM
  useEffect(() => {
    if (!assetsReady) return;

    // Step 1: Wait 150ms
    const t1 = setTimeout(() => setStep(2), 150);

    // Step 2: Gentle scale-in (950ms) -> Ends at t = 1100ms
    // Step 3: Pause 400ms -> Ends at t = 1500ms
    const t2 = setTimeout(() => setStep(4), 1500);

    // Step 4: Assembly glide slide out (950ms) -> Ends at t = 2450ms
    // Step 5: Hold assembled logo (500ms) -> Ends at t = 2950ms
    const t3 = setTimeout(() => setStep(6), 2950);

    // Step 6: Gentle hero emphasis scale (650ms) -> Ends at t = 3600ms
    const t4 = setTimeout(() => setStep(7), 3600);

    // Step 7: Fade away reveal (750ms) -> Ends at t = 4350ms
    const t5 = setTimeout(() => {
      onComplete();
    }, 4350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [assetsReady, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={step === 7 ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.75, ease: EASE_EXPO }}
      style={{ willChange: "opacity" }}
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none pointer-events-none font-sans ${
        isLight ? "bg-[#F8FAFC]" : "bg-[#0B0D13]"
      }`}
    >
      {/* Soft Ambient Glow (Blue for Dark / Green for Light) */}
      <div
        className={`absolute w-[450px] h-[450px] rounded-full blur-[140px] pointer-events-none ${
          isLight ? "bg-emerald-600/12" : "bg-blue-600/12"
        }`}
      />

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
          duration: step === 6 ? 0.65 : step === 7 ? 0.75 : 0.5,
          ease: EASE_CUBIC,
        }}
        style={{ willChange: "transform, opacity" }}
        className="relative flex items-center justify-center max-w-[90vw] sm:max-w-none"
      >
        {/* TF Icon Container */}
        <motion.div
          initial={{ scale: 0.05, opacity: 0, x: 0 }}
          animate={{
            scale: step >= 2 ? 1 : 0.05,
            opacity: step >= 2 ? 1 : 0,
            x: step >= 4 ? -8 : 0,
          }}
          transition={{
            scale: { duration: 0.95, ease: EASE_EXPO },
            opacity: { duration: 0.7, ease: "easeOut" },
            x: { duration: 0.95, ease: EASE_CUBIC },
          }}
          style={{ willChange: "transform, opacity" }}
          className="relative shrink-0 z-20 flex items-center justify-center"
        >
          {/* Soft Focused Icon Glow */}
          <div
            className={`absolute -inset-6 rounded-full blur-3xl pointer-events-none ${
              isLight ? "bg-emerald-500/15" : "bg-blue-500/12"
            }`}
          />

          {/* Official TF Icon Asset */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isLight ? "/logo_icon_light.png" : "/logo_icon.png"}
            alt="TradeFourge Icon"
            className="w-24 sm:w-32 md:w-36 h-auto object-contain drop-shadow-2xl"
          />
        </motion.div>

        {/* TradeFourge Wordmark (Hardware-Accelerated Slide Reveal from behind Icon) */}
        <div className="relative z-10 shrink-0 overflow-hidden ml-3 sm:ml-5 md:ml-6">
          <motion.div
            initial={{ opacity: 0, x: "-100%" }}
            animate={
              step >= 4
                ? { opacity: 1, x: "0%" }
                : { opacity: 0, x: "-100%" }
            }
            transition={{
              duration: 0.95,
              ease: EASE_CUBIC,
            }}
            style={{ willChange: "transform, opacity" }}
            className="flex items-center"
          >
            {/* Official TradeFourge Wordmark Asset */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isLight ? "/logo_wordmark_light.png" : "/logo_wordmark.png"}
              alt="TradeFourge Wordmark"
              className="h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-xl"
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
