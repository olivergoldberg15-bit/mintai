import { NextResponse } from "next/server";
import { complete, parseJson, TutorError } from "@/lib/openrouter";
import { FLASHCARD_SYSTEM, QUIZ_SYSTEM, RECAP_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Kind = "cards" | "quiz" | "recap";

export async function POST(req: Request) {
  let body: { kind?: Kind; source?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const source = (body.source ?? "").trim();
  if (source.length < 20) {
    return NextResponse.json(
      { error: "Add a bit more to work from — a paragraph of notes is plenty." },
      { status: 400 },
    );
  }

  const count = Math.min(Math.max(body.count ?? 8, 3), 15);

  const jobs: Record<Kind, { system: string; ask: string; tokens: number }> = {
    cards: {
      system: FLASHCARD_SYSTEM,
      ask: `Make ${count} flashcards from this:\n\n${source}`,
      tokens: 2600,
    },
    quiz: {
      system: QUIZ_SYSTEM,
      ask: `Write ${count} multiple-choice questions from this:\n\n${source}`,
      tokens: 3200,
    },
    recap: {
      system: RECAP_SYSTEM,
      ask: `Turn this into a class recap:\n\n${source}`,
      tokens: 2800,
    },
  };

  const job = jobs[body.kind ?? "cards"] ?? jobs.cards;

  try {
    const out = await complete(
      [
        { role: "system", content: job.system },
        { role: "user", content: job.ask },
      ],
      { maxTokens: job.tokens, temperature: 0.4, json: true },
    );

    return NextResponse.json({ data: parseJson(out.text), model: out.model });
  } catch (err) {
    const e = err as TutorError;
    return NextResponse.json(
      { error: "Couldn't build that just now. Try again in a moment.", detail: e.message },
      { status: e.status ?? 502 },
    );
  }
}
