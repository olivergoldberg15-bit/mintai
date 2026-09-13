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

// Warm, unhurried, reads well as a tutor. Override with ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    // Not an error — the client uses the browser voice instead.
    return NextResponse.json({ error: "tts-not-configured" }, { status: 501 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 1200);
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });

  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // 401 bad key or 429 quota — let the client drop to the browser voice.
      return NextResponse.json(
        { error: "tts-failed", status: res.status, detail: detail.slice(0, 200) },
        { status: res.status === 401 || res.status === 429 ? 502 : 502 },
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "tts-failed" }, { status: 502 });
  }
}
