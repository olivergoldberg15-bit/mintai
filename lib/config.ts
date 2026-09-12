/**
 * Supabase connection values, resolved once for both the browser client and
 * the server-side health check so the two can never disagree.
 *
 * These ship as committed defaults on purpose. Both are NEXT_PUBLIC_, so
 * Next.js compiles them into the browser bundle and serves them to every
 * visitor no matter where they are configured — committing them exposes
 * nothing that deploying does not.
 *
 * The key below is a publishable client identifier, not a credential: it
 * grants no access on its own. Row-level security is the boundary that
 * actually protects data. Every table is RLS-enabled and scoped to
 * auth.uid(), verified by an anonymous reader seeing zero rows and being
 * refused inserts.
 *
 * The real secret in this app is OPENROUTER_API_KEY, which is server-side only
 * and is never bundled.
 *
 * Environment variables still win where set, so a fork can point at its own
 * project without touching this file.
 */

const DEFAULT_URL = "https://fhitmtbhaqqqjfdjennl.supabase.co";

// Supabase's modern *publishable* key. Unlike the legacy anon JWT, this is
// explicitly a public client identifier, carries no claims, and is rotatable
// on its own. It is the value Supabase recommends shipping in client code.
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable__5f0g2XFNq31gm-bqyHu1g_sjiE9SLZ";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY;

/** True when accounts and sync are available. */
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Whether the values came from the environment or the committed defaults. */
export const SUPABASE_FROM_ENV = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
