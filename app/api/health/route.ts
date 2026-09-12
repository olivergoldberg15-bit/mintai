import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment self-check. Visit /api/health on the deployed site to see what is
 * actually configured there. Reports only whether values are present and how
 * they are shaped — never the values themselves.
 */
export async function GET() {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
      supabase_url_set: Boolean(url),
      supabase_anon_key_set: Boolean(anon),
      status:
        url && anon
          ? "ready"
          : "not configured — the app runs on-device only, with no sign-in or sync",
    },
    site_url: {
      value: process.env.NEXT_PUBLIC_SITE_URL || null,
      status: process.env.NEXT_PUBLIC_SITE_URL
        ? "set"
        : "not set — Google sign-in redirects may land on the wrong URL",
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
