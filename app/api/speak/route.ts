import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * ElevenLabs text-to-speech.
 *
 * Browser speech synthesis has a hard ceiling on how human it can sound. When
 * ELEVENLABS_API_KEY is set this route returns real audio instead, and the
 * client falls back to the browser voice when it is not — so the app works
 * either way.
 *
 * Returning audio also gives the client a waveform to animate the orb from,
 * which speechSynthesis cannot provide.
 */

/**
 * Voices a free-tier key can actually use, verified against the live API.
 *
 * ElevenLabs splits voices into "default" and "library", and free accounts get
 * 402 paid_plan_required on anything from the library — including Rachel
 * (21m00Tcm4TlvDq8ikWAM) and Aria, which are the ones most examples reach for.
 * These three returned real audio on a free key.
 */
const FREE_VOICES = [
  "EXAVITQu4vr4xnSDxMaL", // Sarah — warm, unhurried, reads well as a tutor
  "FGY2WhTYpPnrIDTdsKH5", // Laura
  "JBFqnCBsd6RMkjVDRZzb", // George
];

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    // Not an error — the client uses the browser voice instead.
    return NextResponse.json({ error: "tts-not-configured" }, { status: 501 });
  }

  let body: { text?: string; voiceId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 1200);
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });

  // The listener's pick wins, then a configured default, then the verified
  // free ones as a fallback.
  const chosen = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  const configured = process.env.ELEVENLABS_VOICE_ID;
  const voices = [...new Set([chosen, configured, ...FREE_VOICES].filter(Boolean))] as string[];

  const payload = JSON.stringify({
    text,
    // Flash is the low-latency model — it matters when someone is sitting
    // waiting for a reply out loud.
    model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
    voice_settings: {
      stability: 0.4,        // lower = more expressive, less monotone
      similarity_boost: 0.75,
      style: 0.35,
      use_speaker_boost: true,
    },
  });

  let last = { status: 502, detail: "" };

  for (const voice of voices) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(25_000),
        },
      );

      if (res.ok) {
        return new NextResponse(await res.arrayBuffer(), {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      }

      last = { status: res.status, detail: (await res.text().catch(() => "")).slice(0, 200) };

      // 402 means this particular voice needs a paid plan — the next one may
      // not. Anything else (bad key, quota, outage) will not improve by
      // retrying with a different voice.
      if (res.status !== 402) break;
    } catch (e) {
      last = { status: 502, detail: (e as Error).message.slice(0, 200) };
      break;
    }
  }

  return NextResponse.json(
    { error: "tts-failed", status: last.status, detail: last.detail },
    { status: 502 },
  );
}
