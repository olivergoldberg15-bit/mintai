import { NextResponse } from "next/server";
import { complete, parseJson, TutorError } from "@/lib/openrouter";
import { VIDEO_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Pick = { title: string; channel: string; why: string; search: string };
type Video = Pick & { url: string; thumb: string | null; real: boolean };

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";

/**
 * Upgrade a suggested search into a real video when a YouTube key is configured.
 * Without a key we link to the search itself, which still lands the student in
 * the right place for free.
 */
async function resolve(pick: Pick): Promise<Video> {
  const fallback: Video = {
    ...pick,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(pick.search)}`,
    thumb: null,
    real: false,
  };

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return fallback;

  try {
    const url =
      `${YT_SEARCH}?part=snippet&type=video&maxResults=1&safeSearch=strict` +
      `&videoEmbeddable=true&q=${encodeURIComponent(pick.search)}&key=${key}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fallback;

    const item = (await res.json())?.items?.[0];
    if (!item?.id?.videoId) return fallback;

    return {
      ...pick,
      title: item.snippet?.title ?? pick.title,
      channel: item.snippet?.channelTitle ?? pick.channel,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumb: item.snippet?.thumbnails?.medium?.url ?? null,
      real: true,
    };
  } catch {
    return fallback;
  }
}

export async function POST(req: Request) {
  let body: { topic?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim().slice(0, 600);
  if (!topic) {
    return NextResponse.json({ error: "What topic are we looking for?" }, { status: 400 });
  }

  try {
    const out = await complete(
      [
        { role: "system", content: VIDEO_SYSTEM },
        { role: "user", content: `Topic: ${topic}` },
      ],
      { maxTokens: 2000, temperature: 0.5, json: true },
    );

    const picks = parseJson<{ queries?: Pick[] }>(out.text).queries ?? [];
    const videos = await Promise.all(picks.slice(0, 4).map(resolve));

    return NextResponse.json({ videos, model: out.model });
  } catch (err) {
    const e = err as TutorError;
    return NextResponse.json(
      { error: "Couldn't find videos just now.", detail: e.message },
      { status: e.status ?? 502 },
    );
  }
}
