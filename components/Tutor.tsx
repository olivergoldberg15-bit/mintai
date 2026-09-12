"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import Mascot from "./Mascot";
import { SendIcon, VideoIcon, PlayIcon } from "./Icons";
import { save, type ChatMsg, type TutorSession } from "@/lib/store";
import { postJson } from "@/lib/api";

type Video = { title: string; channel: string; why: string; url: string; thumb: string | null };

export type TutorHandle = { start: (image: string, caption?: string) => void };

/**
 * The tutoring conversation. Scan and Chat both mount this — Scan feeds it a
 * photo, Chat feeds it text. Everything about staying unstuck lives here.
 */
export default function Tutor({
  source,
  userId,
  seed,
  onProblem,
  placeholder = "What are you stuck on?",
}: {
  source: "scan" | "chat";
  userId: string | null;
  seed?: { image: string; caption?: string } | null;
  onProblem?: (p: { subject: string | null; problem: string | null }) => void;
  placeholder?: string;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [mode, setMode] = useState<"guide" | "explain">("guide");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [vidBusy, setVidBusy] = useState(false);
  const [topic, setTopic] = useState<string>("");

  // What to re-send if a request fails. The user's photo and words are never
  // thrown away on an error — Retry replays exactly this.
  const pending = useRef<{ history: ChatMsg[]; image: string | null } | null>(null);
  const sessionId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy, videos]);

  const persist = useCallback(
    async (all: ChatMsg[], subject: string | null, problem: string | null) => {
      if (!all.length) return;
      const row = {
        id: sessionId.current ?? undefined,
        mode,
        source,
        subject,
        problem,
        title: (problem || all[0]?.content || "Session").slice(0, 70),
        // Images are big; keep them out of storage and keep the text.
        messages: all.map(({ role, content }) => ({ role, content })),
      };
      const saved = (await save("sessions", userId, row as never)) as TutorSession;
      sessionId.current = saved.id;
    },
    [mode, source, userId],
  );

  const run = useCallback(
    async (history: ChatMsg[], image: string | null) => {
      pending.current = { history, image };
      setBusy(true);
      setError(null);

      try {
        const data = await postJson<{
          reply: string;
          subject?: string | null;
          problem?: string | null;
        }>("/api/tutor", {
          messages: history.map(({ role, content }) => ({ role, content })),
          mode,
          image,
        });

        // A scanned photo comes back as readable text — fold it into the first
        // user turn so follow-ups have context without re-sending the image.
        let next = history;
        if (image && data.problem) {
          next = [{ role: "user", content: data.problem, image }, ...history];
          setTopic(data.problem);
          onProblem?.({ subject: data.subject ?? null, problem: data.problem });
        }

        const all: ChatMsg[] = [...next, { role: "assistant", content: data.reply }];
        setMsgs(all);
        pending.current = null;
        void persist(all, data.subject ?? null, data.problem ?? null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [mode, onProblem, persist],
  );

  // A photo arriving from the Scan tab.
  useEffect(() => {
    if (!seed?.image) return;
    setMsgs([{ role: "user", content: seed.caption ?? "", image: seed.image }]);
    setVideos(null);
    sessionId.current = null;
    void run([], seed.image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.image]);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    if (!topic) setTopic(text);
    const history: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(history);
    void run(history, null);
  };

  const retry = () => {
    const p = pending.current;
    if (!p) return;
    void run(p.history, p.image);
  };

  const findVideos = async () => {
    const q = topic || msgs.find((m) => m.role === "user")?.content;
    if (!q) return;
    setVidBusy(true);
    try {
      const data = await postJson<{ videos?: Video[] }>("/api/videos", { topic: q });
      setVideos(data.videos ?? []);
    } catch {
      setVideos([]);
    } finally {
      setVidBusy(false);
    }
  };

  const started = msgs.length > 0;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="seg">
        <button className={mode === "guide" ? "on" : ""} onClick={() => setMode("guide")}>
          Guide me
        </button>
        <button className={mode === "explain" ? "on" : ""} onClick={() => setMode("explain")}>
          Explain it
        </button>
      </div>

      <p className="tiny muted" style={{ marginTop: -4 }}>
        {mode === "guide"
          ? "Questions that get you to the answer yourself."
          : "The idea broken down — still not your homework answer."}
      </p>

      {!started && (
        <div className="empty">
          <Mascot mood="idle" size={92} />
          <h3 className="mt12">{source === "scan" ? "Take a photo of the problem" : "Type the problem"}</h3>
          <p>You get the questions, not the answers.</p>
        </div>
      )}

      {started && (
        <div className="thread">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
              {m.image && (
                <img src={m.image} alt="The problem you scanned" style={{ marginBottom: m.content ? 9 : 0 }} />
              )}
              {m.content &&
                (m.role === "assistant" ? <Markdown text={m.content} /> : <p>{m.content}</p>)}
            </div>
          ))}

          {busy && (
            <div className="msg bot">
              <span className="dots">
                <i /><i /><i />
              </span>
            </div>
          )}

          {error && (
            <div className="msg err">
              <p>{error}</p>
              <button className="btn sm secondary mt8" onClick={retry} disabled={busy}>
                Retry
              </button>
            </div>
          )}

          <div ref={endRef} />
        </div>
      )}

      {started && !busy && !error && (
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn sm secondary" onClick={findVideos} disabled={vidBusy}>
            {vidBusy ? <span className="spin dark" /> : <VideoIcon />}
            {vidBusy ? "Finding" : "Short videos"}
          </button>
          <button
            className="btn sm ghost"
            onClick={() => {
              setDraft("I'm still stuck. Ask me something smaller.");
            }}
          >
            Still stuck
          </button>
        </div>
      )}

      {videos && (
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Worth watching</h3>
          <p className="tiny muted mt8">Short, visual, gets to the point.</p>
          <div className="col mt12" style={{ gap: 9 }}>
            {videos.length === 0 && <p className="small muted">Nothing good found — try rewording the topic.</p>}
            {videos.map((v, i) => (
              <a key={i} className="vid" href={v.url} target="_blank" rel="noreferrer">
                <span className="thumb">
                  {v.thumb ? <img src={v.thumb} alt="" /> : <PlayIcon className="" />}
                </span>
                <span className="grow">
                  <span className="t" style={{ display: "block" }}>{v.title}</span>
                  <span className="s" style={{ display: "block" }}>{v.channel} · {v.why}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 9, alignItems: "flex-end" }}>
        <textarea
          className="textarea grow"
          rows={1}
          value={draft}
          placeholder={started ? "Answer, or say you're stuck" : placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="btn"
          onClick={send}
          disabled={busy || !draft.trim()}
          aria-label="Send"
          style={{ padding: 13, flex: "none" }}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
