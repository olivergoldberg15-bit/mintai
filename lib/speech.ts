"use client";

/** Browser speech types aren't in lib.dom, so declare the slice we use. */

export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

export type RecEvent = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

type RecCtor = new () => Recognition;

export function recognitionCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return recognitionCtor() !== null;
}

/** Prefer a natural-sounding English voice over the robotic default. */
export function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const wanted = [
    "Samantha", "Google US English", "Microsoft Aria", "Microsoft Jenny",
    "Karen", "Moira", "Serena", "Daniel", "Google UK English Female",
  ];

  for (const name of wanted) {
    const hit = voices.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  return voices.find((v) => v.lang.startsWith("en") && v.localService) ??
         voices.find((v) => v.lang.startsWith("en")) ??
         voices[0];
}

/** Strip markdown and notation the synthesiser reads out literally. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_#`>]/g, "")
    .replace(/\^2\b/g, " squared")
    .replace(/\^3\b/g, " cubed")
    .replace(/\^(\d+)/g, " to the power of $1")
    .replace(/\bsqrt\b/gi, "square root of")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 over $2")
    .replace(/\s*[-–—]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
