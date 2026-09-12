"use client";

import { supabase, cloudEnabled } from "./supabase";

/**
 * One data layer, two backends.
 *
 * Signed in  -> Supabase, synced across devices.
 * Signed out -> localStorage, so the app is fully usable before anyone makes
 *               an account. Signing in migrates whatever is on the device up.
 */

export type Card = { front: string; back: string };
export type Question = { q: string; options: string[]; answer: number; why?: string };
export type Term = { term: string; def: string };
export type ChatMsg = { role: "user" | "assistant"; content: string; image?: string };

export type Task = {
  id: string;
  title: string;
  subject?: string | null;
  due_on?: string | null; // YYYY-MM-DD
  done: boolean;
  created_at: string;
};

export type Deck = {
  id: string;
  title: string;
  subject?: string | null;
  cards: Card[];
  created_at: string;
};

export type Quiz = {
  id: string;
  title: string;
  subject?: string | null;
  questions: Question[];
  score?: number | null;
  total?: number | null;
  created_at: string;
};

export type Recap = {
  id: string;
  title: string;
  subject?: string | null;
  summary?: string | null;
  points: string[];
  terms: Term[];
  transcript?: string | null;
  created_at: string;
};

export type TutorSession = {
  id: string;
  mode: "guide" | "explain";
  source: "scan" | "chat" | "voice";
  subject?: string | null;
  title?: string | null;
  problem?: string | null;
  messages: ChatMsg[];
  created_at: string;
};

export type Profile = {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  grade?: string | null;
};

const TABLES = {
  tasks: "tasks",
  decks: "flashcard_sets",
  quizzes: "quizzes",
  recaps: "recaps",
  sessions: "tutor_sessions",
} as const;

type Kind = keyof typeof TABLES;
type Shape = { tasks: Task; decks: Deck; quizzes: Quiz; recaps: Recap; sessions: TutorSession };

const key = (k: Kind) => `tm.${k}`;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ---------------- local ---------------- */

function readLocal<K extends Kind>(k: K): Shape[K][] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(k));
    return raw ? (JSON.parse(raw) as Shape[K][]) : [];
  } catch {
    return [];
  }
}

function writeLocal<K extends Kind>(k: K, rows: Shape[K][]): void {
  try {
    window.localStorage.setItem(key(k), JSON.stringify(rows));
  } catch {
    /* private mode or quota — the app still works for this session */
  }
}

/* ---------------- public API ---------------- */

export async function list<K extends Kind>(k: K, userId: string | null): Promise<Shape[K][]> {
  const db = supabase();
  if (userId && db) {
    const { data, error } = await db
      .from(TABLES[k])
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) return data as Shape[K][];
  }
  return readLocal(k);
}

export async function save<K extends Kind>(
  k: K,
  userId: string | null,
  row: Omit<Shape[K], "id" | "created_at"> & Partial<Pick<Shape[K], "id">>,
): Promise<Shape[K]> {
  const db = supabase();

  if (userId && db) {
    const payload: Record<string, unknown> = { ...row, user_id: userId };
    if (!payload.id) delete payload.id;
    const { data, error } = await db
      .from(TABLES[k])
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (!error && data) return data as Shape[K];
    // fall through to local so the user never loses work on a network blip
  }

  const rows = readLocal(k);
  const existing = row.id ? rows.findIndex((r) => r.id === row.id) : -1;
  const saved = {
    ...(existing >= 0 ? rows[existing] : {}),
    ...row,
    id: row.id ?? newId(),
    created_at: existing >= 0 ? rows[existing].created_at : new Date().toISOString(),
  } as Shape[K];

  if (existing >= 0) rows[existing] = saved;
  else rows.unshift(saved);

  writeLocal(k, rows);
  return saved;
}

export async function remove(k: Kind, userId: string | null, id: string): Promise<void> {
  const db = supabase();
  if (userId && db) {
    const { error } = await db.from(TABLES[k]).delete().eq("id", id).eq("user_id", userId);
    if (!error) return;
  }
  writeLocal(k, readLocal(k).filter((r) => r.id !== id));
}

/**
 * Push anything created while signed out into the account, once.
 * Runs after the first successful sign-in on a device.
 */
export async function migrateLocal(userId: string): Promise<void> {
  const db = supabase();
  if (!db) return;

  const flag = `tm.migrated.${userId}`;
  try {
    if (window.localStorage.getItem(flag)) return;
  } catch {
    return;
  }

  for (const k of Object.keys(TABLES) as Kind[]) {
    const rows = readLocal(k);
    if (!rows.length) continue;
    const payload = rows.map(({ id: _id, created_at, ...rest }) => ({
      ...rest,
      user_id: userId,
      created_at,
    }));
    await db.from(TABLES[k]).insert(payload);
  }

  try {
    window.localStorage.setItem(flag, "1");
    for (const k of Object.keys(TABLES) as Kind[]) window.localStorage.removeItem(key(k));
  } catch {
    /* ignore */
  }
}

/* ---------------- profile ---------------- */

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function saveProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const db = supabase();
  if (!db) return;
  await db.from("profiles").upsert({ id: userId, ...patch, updated_at: new Date().toISOString() });
}

export { cloudEnabled };
