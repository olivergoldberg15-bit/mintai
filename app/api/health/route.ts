import { NextResponse } from "next/server";
import { CLOUD_ENABLED, SUPABASE_FROM_ENV, SUPABASE_URL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment self-check. Visit /api/health on the deployed site to see what is
 * actually configured there. Reports only whether values are present and how
 * they are shaped — never the values themselves.
 */
export async function GET() {
  const key = process.env.OPENROUTER_API_KEY ?? "";

  const checks = {
    tutor: {
      openrouter_key_set: Boolean(key),
      key_looks_right: key.startsWith("sk-or-"),
      status: key
        ? key.startsWith("sk-or-")
          ? "ready"
          : "key is set but does not look like an OpenRouter key"
        : "MISSING — Scan, Chat and Voice will not work. Add OPENROUTER_API_KEY.",
    },
    accounts: {
      configured: CLOUD_ENABLED,
      project: SUPABASE_URL || null,
      source: SUPABASE_FROM_ENV ? "environment variables" : "built-in defaults",
      status: CLOUD_ENABLED
        ? "ready"
        : "not configured — the app runs on-device only, with no sign-in or sync",
    },
    voice: {
      elevenlabs_key_set: Boolean(process.env.ELEVENLABS_API_KEY),
      key_looks_right: (process.env.ELEVENLABS_API_KEY ?? "").startsWith("sk_"),
      status: process.env.ELEVENLABS_API_KEY
        ? (process.env.ELEVENLABS_API_KEY ?? "").startsWith("sk_")
          ? "ready — replies use the ElevenLabs voice"
          : "key is set but does not look like an ElevenLabs key (they start with sk_)"
        : "not set — replies use the device's built-in voice",
    },

    site_url: {
      value: process.env.NEXT_PUBLIC_SITE_URL || null,
      // Sign-in redirects use window.location.origin at runtime, so this is
      // only used for OpenRouter attribution. Optional either way.
      status: process.env.NEXT_PUBLIC_SITE_URL ? "set" : "not set — optional",
    },
    models: {
      text: (process.env.OPENROUTER_TEXT_MODELS ?? "built-in chain").split(",")[0],
      vision: (process.env.OPENROUTER_VISION_MODELS ?? "built-in chain").split(",")[0],
    },
  };

  const ok = checks.tutor.openrouter_key_set && checks.tutor.key_looks_right;

  return NextResponse.json(
    { ok, summary: ok ? "Tutoring is configured." : "Tutoring is NOT configured.", checks },
    { status: 200 },
  );
}
