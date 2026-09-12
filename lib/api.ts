"use client";

/**
 * One way to call our API routes.
 *
 * The important part is that a response is not always JSON. If a serverless
 * function times out, runs out of memory, or the deploy is missing, the
 * platform returns its own HTML error page — and calling res.json() on that
 * throws "Unexpected token '<'", which tells the student nothing. Everything
 * that comes out of here is a sentence a person can act on.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  const raw = await res.text();

  let data: { error?: string } | null = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Not JSON — the platform answered instead of our route.
    if (res.status === 504 || res.status === 408) {
      throw new Error("That took too long. The free models are busy — tap Retry.");
    }
    if (res.status === 413) {
      throw new Error("That photo is too big. Try again with a tighter crop.");
    }
    throw new Error(
      res.ok
        ? "Got an unreadable reply from the server. Tap Retry."
        : `The server hit an error (${res.status}). Tap Retry.`,
    );
  }

  if (!res.ok) throw new Error(data?.error ?? `Something went wrong (${res.status}).`);
  if (!data) throw new Error("The server sent back nothing. Tap Retry.");

  return data as T;
}
