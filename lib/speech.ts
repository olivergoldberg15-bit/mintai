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

/* ------------------------------------------------------------------ *
 * Voices
 * ------------------------------------------------------------------ */

/**
 * getVoices() is empty on first call in every browser — the list arrives
 * later on `voiceschanged`. Calling it synchronously and giving up is what
 * makes an app fall back to the default (worst) voice, so wait for it.
 */
export function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve([]);

    const synth = window.speechSynthesis;
    const ready = synth.getVoices();
    if (ready.length) return resolve(ready);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener("voiceschanged", finish);
      clearInterval(poll);
      clearTimeout(bail);
      resolve(synth.getVoices());
    };

    synth.addEventListener("voiceschanged", finish);
    // Safari sometimes never fires the event but populates the list anyway.
    const poll = setInterval(() => { if (synth.getVoices().length) finish(); }, 150);
    const bail = setTimeout(finish, timeoutMs);
  });
}

// macOS ships joke voices ("Bubbles", "Zarvox", "Trinoids"). They are in the
// list, they are English, and an unranked pick can land on one.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|rocko|shelley|sandy|eddy|flo|reed|junior|kathy|princess|ralph|fred|agnes|victoria|bruce/i;

// Markers vendors use for their modern, neural-quality voices.
const PREMIUM = /natural|neural|enhanced|premium|siri|online|wavenet|studio|journey/i;

// Named voices that are reliably decent where they exist.
const GOOD = /samantha|ava|allison|susan|zoe|evan|nathan|joelle|noelle|aria|jenny|guy|michelle|ana|serena|karen|moira|tessa|daniel|arthur|google (uk|us) english/i;

// iOS "compact" variants are the small, robotic ones.
const COMPACT = /compact|eloquence|espeak|pico|festival/i;

/**
 * Rank a voice by how human it is likely to sound. Higher is better.
 * Ranking rather than a fixed wishlist, because the available set differs on
 * every OS, browser and version.
 */
export function scoreVoice(v: SpeechSynthesisVoice, locale = "en-US"): number {
  const name = `${v.name} ${v.voiceURI}`;
  let score = 0;

  if (NOVELTY.test(name)) score -= 200;
  if (COMPACT.test(name)) score -= 120;

  if (PREMIUM.test(name)) score += 100;
  if (GOOD.test(name)) score += 55;

  // Network-backed voices are almost always the neural ones. The old code
  // preferred localService, which selected for exactly the robotic voices.
  if (!v.localService) score += 45;

  const lang = v.lang.replace("_", "-");
  if (lang.toLowerCase() === locale.toLowerCase()) score += 35;
  else if (lang.toLowerCase().startsWith("en")) score += 22;
  else score -= 60; // wrong language reads the words phonetically wrong

  if (v.default) score += 5;

  return score;
}

/** English voices, best first. */
export function rankedVoices(
  voices: SpeechSynthesisVoice[],
  locale = "en-US",
): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .map((v) => ({ v, s: scoreVoice(v, locale) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI?: string | null,
  locale = "en-US",
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  if (preferredURI) {
    const saved = voices.find((v) => v.voiceURI === preferredURI);
    if (saved) return saved;
  }
  return rankedVoices(voices, locale)[0] ?? voices[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Text for the ear
 * ------------------------------------------------------------------ */

/** Turn written maths and markdown into something a synthesiser reads well. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_#>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")     // links → their label

    // powers and roots
    .replace(/\^2\b/g, " squared")
    .replace(/\^3\b/g, " cubed")
    .replace(/\^\(?(-?\d+)\)?/g, " to the power of $1")
    .replace(/\bsqrt\s*\(([^)]*)\)/gi, "the square root of $1")
    .replace(/\bsqrt\b/gi, "square root")
    .replace(/√\s*/g, "the square root of ")

    // operators, only where they sit between values
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 over $2")
    .replace(/\s*=\s*/g, " equals ")
    .replace(/\s*≈\s*/g, " is about ")
    .replace(/\s*≠\s*/g, " does not equal ")
    .replace(/\s*≤\s*/g, " is less than or equal to ")
    .replace(/\s*≥\s*/g, " is greater than or equal to ")
    .replace(/(\w)\s*<\s*(\w)/g, "$1 is less than $2")
    .replace(/(\w)\s*>\s*(\w)/g, "$1 is greater than $2")
    // Operators follow a value, which is often a variable ("2x + 5"), not
    // just a digit — hence the word-character class rather than \d.
    .replace(/([\w)])\s*\+\s*(?=[\w(])/g, "$1 plus ")
    .replace(/([\w)])\s*[×]\s*(?=[\w(])/g, "$1 times ")
    .replace(/([\w)])\s*÷\s*(?=[\w(])/g, "$1 divided by ")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/(\d)\s*°/g, "$1 degrees")
    .replace(/π/g, " pi ")

    // a minus sign is only a minus between two numbers; leave hyphenated
    // words alone, or "self-esteem" becomes "self, esteem"
    .replace(/(\d)\s*[-−]\s*(\d)/g, "$1 minus $2")
    // Spaces on both sides mark a real minus; "self-esteem" has none.
    .replace(/([\w)])\s+[-−]\s+(?=[\w(])/g, "$1 minus ")
    .replace(/ [–—] /g, ", ")

    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/**
 * Split into speakable chunks at sentence boundaries.
 *
 * Two reasons. Chrome silently truncates utterances longer than roughly 15
 * seconds, so long replies get cut off mid-word. And a single flat utterance
 * has no phrasing — chunk boundaries give the cadence of someone thinking,
 * which is most of what "not robotic" means.
 */
export function splitForSpeech(text: string, maxChars = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const out: string[] = [];
  let buf = "";

  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;

    if (s.length > maxChars) {
      if (buf) { out.push(buf); buf = ""; }
      // Break an over-long sentence on commas rather than mid-phrase.
      let part = "";
      for (const piece of s.split(/,\s*/)) {
        if ((part + piece).length > maxChars && part) { out.push(part.trim() + ","); part = ""; }
        part += (part ? ", " : "") + piece;
      }
      if (part.trim()) out.push(part.trim());
    } else if ((buf + " " + s).trim().length > maxChars) {
      if (buf) out.push(buf);
      buf = s;
    } else {
      buf = (buf ? buf + " " : "") + s;
    }
  }

  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/**
 * Speak a reply with natural phrasing. Returns a cancel function.
 *
 * A tutor's question should land a touch slower than conversation, and pitch
 * is left at 1.0 — shifting it is what makes a good voice sound synthetic.
 */
export function speakNaturally(
  text: string,
  voice: SpeechSynthesisVoice | null,
  opts: { onDone?: () => void; onError?: () => void; rate?: number } = {},
): () => void {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth) { opts.onDone?.(); return () => {}; }

  synth.cancel();

  const chunks = splitForSpeech(speakable(text));
  if (!chunks.length) { opts.onDone?.(); return () => {}; }

  let cancelled = false;
  let i = 0;

  const next = () => {
    if (cancelled) return;
    if (i >= chunks.length) { opts.onDone?.(); return; }

    const u = new SpeechSynthesisUtterance(chunks[i++]);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = opts.rate ?? 0.97;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.onend = next;
    u.onerror = () => { if (!cancelled) { opts.onError?.(); opts.onDone?.(); } };
    synth.speak(u);
  };

  next();

  return () => { cancelled = true; synth.cancel(); };
}
