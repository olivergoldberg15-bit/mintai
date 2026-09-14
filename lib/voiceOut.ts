"use client";

import { speakNaturally, speakable } from "./speech";

/**
 * One way to speak, two engines.
 *
 * Preferred: ElevenLabs audio from /api/speak, played through Web Audio with
 * an analyser so the orb can move to the actual waveform.
 * Fallback: the browser's own voice, when ElevenLabs is not configured or is
 * out of quota. There the level is synthesised, since speechSynthesis exposes
 * no audio to measure.
 */

export type Speaker = {
  stop: () => void;
  /** 0..1, updated continuously while speaking. Read it in a rAF loop. */
  level: { current: number };
};

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === "closed") ctx = new Ctor();
  return ctx;
}

/**
 * Unlock audio playback. MUST be called synchronously inside a real user
 * gesture — a tap handler, not a promise callback.
 *
 * iOS and Chrome only allow audio that a person started. By the time a spoken
 * reply is ready we are several awaits past the tap, so a context created then
 * is born suspended and every buffer plays in silence. Creating it during the
 * tap and priming it with a silent buffer keeps it running for the rest of the
 * session, which is what makes the later playback audible.
 */
export function unlockAudio(): void {
  const ac = audioContext();
  if (!ac) return;
  void ac.resume();
  try {
    const buf = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
  } catch {
    /* already running */
  }
}

/** True once /api/speak has answered with real audio at least once. */
let ttsAvailable: boolean | null = null;

export function speak(
  text: string,
  opts: {
    voice?: SpeechSynthesisVoice | null;
    onDone?: () => void;
    onEngine?: (engine: "elevenlabs" | "browser") => void;
    onFallback?: (reason: string) => void;
    /** ElevenLabs voice id; the server picks a default when omitted. */
    voiceId?: string | null;
  } = {},
): Speaker {
  const level = { current: 0 };
  let cancelled = false;
  let stopInner: (() => void) | null = null;

  const finish = () => {
    level.current = 0;
    if (!cancelled) opts.onDone?.();
  };

  const browser = () => {
    if (cancelled) return;
    opts.onEngine?.("browser");

    // No audio stream to measure, so drive a gentle speech-like wobble.
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      const t = (performance.now() - start) / 1000;
      level.current =
        0.32 + 0.26 * Math.abs(Math.sin(t * 4.1)) + 0.16 * Math.abs(Math.sin(t * 9.7));
      raf = requestAnimationFrame(tick);
    };
    tick();

    const cancel = speakNaturally(text, opts.voice ?? null, {
      onDone: () => { cancelAnimationFrame(raf); finish(); },
    });
    stopInner = () => { cancelAnimationFrame(raf); cancel(); };
  };

  // Skip the round trip once we know the route is not configured.
  if (ttsAvailable === false) {
    browser();
    return { stop: () => { cancelled = true; stopInner?.(); level.current = 0; }, level };
  }

  (async () => {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speakable(text), voiceId: opts.voiceId ?? null }),
      });

      if (!res.ok) {
        if (res.status === 501) {
          ttsAvailable = false; // not configured; stop asking
          opts.onFallback?.("ELEVENLABS_API_KEY is not set on the server");
        } else {
          const info = await res.json().catch(() => null);
          opts.onFallback?.(
            info?.status === 401 ? "ElevenLabs rejected the key"
            : info?.status === 429 ? "ElevenLabs quota reached"
            : info?.status === 402 ? "that ElevenLabs voice needs a paid plan"
            : `ElevenLabs failed (${info?.status ?? res.status})`,
          );
        }
        return browser();
      }

      const blob = await res.blob();
      if (cancelled) return;

      /*
       * Playback goes through an <audio> element rather than
       * decodeAudioData + BufferSource.
       *
       * Two reasons. Safari's decodeAudioData is unreliable on some MP3s and
       * simply rejects, and previously that meant no sound at all — the
       * analyser and the playback were the same code path, so losing the
       * analyser lost the audio with it. An element decodes natively, and the
       * analyser is now layered on top: if it cannot be attached we still
       * hear the reply, just with a synthesised level for the orb.
       */
      const url = URL.createObjectURL(blob);
      const el = new Audio();
      el.src = url;
      el.preload = "auto";
      // Lets iOS play it inline instead of taking over the screen.
      el.setAttribute("playsinline", "");
      el.crossOrigin = "anonymous";

      let raf = 0;
      let detach = () => {};

      const cleanup = () => {
        cancelAnimationFrame(raf);
        detach();
        URL.revokeObjectURL(url);
      };

      // Analyser is best-effort; failure must not cost us the audio.
      const ac = audioContext();
      if (ac) {
        try {
          if (ac.state === "suspended") await ac.resume();
          const src = ac.createMediaElementSource(el);
          const analyser = ac.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.75;
          src.connect(analyser);
          analyser.connect(ac.destination);

          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (cancelled) return;
            analyser.getByteFrequencyData(data);
            // Weight the low-mid band — where speech energy sits — so the orb
            // tracks syllables rather than sibilance.
            let sum = 0;
            const bins = Math.floor(data.length * 0.45);
            for (let i = 0; i < bins; i++) sum += data[i];
            level.current = Math.min(1, (sum / bins / 255) * 2.1);
            raf = requestAnimationFrame(tick);
          };
          tick();
          detach = () => { try { src.disconnect(); analyser.disconnect(); } catch { /* gone */ } };
        } catch {
          // No analyser — drive the orb from the clock instead.
          const t0 = performance.now();
          const tick = () => {
            if (cancelled) return;
            const t = (performance.now() - t0) / 1000;
            level.current = 0.3 + 0.28 * Math.abs(Math.sin(t * 4.3));
            raf = requestAnimationFrame(tick);
          };
          tick();
        }
      }

      el.onended = () => { cleanup(); finish(); };
      el.onerror = () => { cleanup(); if (!cancelled) browser(); };

      stopInner = () => { cleanup(); el.pause(); el.src = ""; };

      try {
        await el.play();
        ttsAvailable = true;
        opts.onEngine?.("elevenlabs");
      } catch {
        // Blocked because no gesture reached this far — say so rather than
        // playing nothing.
        cleanup();
        opts.onFallback?.("the browser blocked audio playback");
        return browser();
      }
    } catch {
      if (!cancelled) browser();
    }
  })();

  return {
    stop: () => { cancelled = true; stopInner?.(); level.current = 0; },
    level,
  };
}
