import { NextResponse } from "next/server";
import { complete, TutorError, type Msg } from "@/lib/openrouter";
import { GUIDE_SYSTEM, EXPLAIN_SYSTEM, READ_IMAGE_SYSTEM, voiceSystem } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages: { role: "user" | "assistant"; content: string }[];
  mode?: "guide" | "explain";
  image?: string | null;   // data URL, only on the first turn of a scan
  voice?: boolean;
};

/** Splits "SUBJECT: ... PROBLEM: ..." out of the vision model's reading. */
function splitReading(raw: string): { subject: string; problem: string } {
  const subject = raw.match(/SUBJECT:\s*(.+)/i)?.[1]?.trim() ?? "";
  const problem = raw.match(/PROBLEM:\s*([\s\S]+)/i)?.[1]?.trim() ?? raw.trim();
  return { subject, problem };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const mode = body.mode === "explain" ? "explain" : "guide";
  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];

  try {
    let subject = "";
    let problem = "";
    const turns: Msg[] = [];

    // Step 1 — if there's a photo, read it first with a vision model. Keeping this
    // separate means follow-up turns are plain text, which the free models handle
    // far better than a growing image context.
    if (body.image) {
      const reading = await complete(
        [
          { role: "system", content: READ_IMAGE_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "What is on this page?" },
              { type: "image_url", image_url: { url: body.image } },
            ],
          },
        ],
        { vision: true, maxTokens: 1500, temperature: 0.15 },
      );

      const parsed = splitReading(reading.text);
      subject = parsed.subject;
      problem = parsed.problem;

      turns.push({
        role: "user",
        content: `Here is the problem from my photo.\n\nSubject: ${subject || "unclear"}\n\n${problem}\n\nI'm stuck.`,
      });
    }

    for (const m of history) {
      if (typeof m?.content === "string" && m.content.trim()) {
        turns.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
      }
    }

    if (!turns.length) {
      return NextResponse.json({ error: "Nothing to work on yet." }, { status: 400 });
    }

    const system = body.voice
      ? voiceSystem(mode)
      : mode === "explain"
        ? EXPLAIN_SYSTEM
        : GUIDE_SYSTEM;

    const answer = await complete([{ role: "system", content: system }, ...turns], {
      maxTokens: body.voice ? 1200 : mode === "explain" ? 2400 : 1600,
      temperature: 0.6,
    });

    return NextResponse.json({
      reply: answer.text,
      model: answer.model,
      subject: subject || null,
      problem: problem || null,
    });
  } catch (err) {
    const e = err as TutorError;
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return NextResponse.json(
      {
        error:
          status === 500
            ? "The server is missing its API key."
            : "Couldn't reach a tutor model just now. Your work is still here — tap Retry.",
        detail: e.message,
      },
      { status },
    );
  }
}
