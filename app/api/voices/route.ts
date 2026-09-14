import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Voices offered in the picker.
 *
 * The obvious implementation — GET /v1/voices — needs the voices_read scope,
 * which TTS-only keys do not have, and it also returns library voices a free
 * account cannot actually speak with. So this is a curated list of default
 * voices verified to return audio on a free key, and the live list is only
 * used to enrich it when the key happens to allow that.
 */
const CURATED = [
  // Every one of these returned 200 with real audio on a free-tier key.
  // Charlotte and Aria and Rachel are NOT here: they answer 402
  // paid_plan_required, and offering a voice that silently becomes a
  // different voice is worse than a shorter list.
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   note: "warm, unhurried" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura",   note: "bright, friendly" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George",  note: "calm, low" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel",  note: "clear, steady" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", note: "lively" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily",    note: "gentle" },
];

export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ voices: [], configured: false });

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      // Keep only voices the account can actually use — library ones 402.
      const usable = (data?.voices ?? [])
        .filter((v: { category?: string }) => v.category !== "professional")
        .map((v: { voice_id: string; name: string; labels?: Record<string, string> }) => ({
          id: v.voice_id,
          name: v.name,
          note: v.labels?.description ?? v.labels?.accent ?? "",
        }));
      if (usable.length) return NextResponse.json({ voices: usable, configured: true });
    }
  } catch {
    /* fall through to the curated list */
  }

  return NextResponse.json({ voices: CURATED, configured: true });
}
