"use client";

import { useEffect, useRef } from "react";

type State = "idle" | "listening" | "thinking" | "speaking";

/**
 * The voice orb: layered green gradients under a grain overlay, drifting
 * slowly, and scaling to the live audio level while it talks.
 *
 * The level is read from a ref inside a rAF loop and written straight to CSS
 * custom properties. Putting it in React state would re-render the tree sixty
 * times a second for an animation the compositor can handle on its own.
 */
export default function Orb({
  state,
  levelRef,
  onClick,
  label,
}: {
  state: State;
  levelRef: { current: number };
  onClick: () => void;
  label: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect the OS setting — a pulsing blob is exactly what this is for.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      el.style.setProperty("--lvl", "0");
      return;
    }

    let raf = 0;
    let shown = 0;

    const tick = () => {
      const target = levelRef.current;
      // Rise fast so syllables land, fall slower so it does not judder.
      shown += (target - shown) * (target > shown ? 0.45 : 0.12);
      el.style.setProperty("--lvl", shown.toFixed(3));
      raf = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <button
      ref={ref}
      className={`orb orb-${state}`}
      onClick={onClick}
      aria-label={label}
      style={{ ["--lvl" as string]: 0 }}
    >
      <span className="orb-skin" aria-hidden="true">
        <span className="orb-blob b1" />
        <span className="orb-blob b2" />
        <span className="orb-blob b3" />
        <span className="orb-blob b4" />
        <span className="orb-blob b5" />
        <span className="orb-grain" />
        <span className="orb-sheen" />
      </span>
    </button>
  );
}
