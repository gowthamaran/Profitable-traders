"use client";

import { useEffect, useRef, useState } from "react";
import { compactNumber } from "@/lib/format";

/**
 * Counts up to a real figure over ~1.1s, then stops. It animates the number of
 * wallets in the database, never a profitability rate.
 *
 * Respects prefers-reduced-motion by rendering the final value immediately,
 * and never blocks interaction.
 */
export function HeroCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || value <= 0) {
      setDisplay(value);
      return;
    }

    const duration = 1100;
    const start = performance.now();
    setDisplay(0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast at first, settles rather than snapping.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  return <span>{compactNumber(display)}</span>;
}
