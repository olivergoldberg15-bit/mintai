"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase is optional. With keys set you get real accounts and sync across
 * devices; without them the app still works and keeps everything on the device.
 */
export const cloudEnabled = Boolean(url && anon);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (!client) {
    client = createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
