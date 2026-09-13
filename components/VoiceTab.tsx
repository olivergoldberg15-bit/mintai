"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceIcon, StopIcon, CloseIcon } from "./Icons";
import Orb from "./Orb";
import { speak as speakOut, type Speaker } from "@/lib/voiceOut";
import {
  recognitionCtor, pickVoice, rankedVoices, loadVoices, speakNaturally,
  type Recognition,
} from "@/lib/speech";
import { save, type ChatMsg } from "@/lib/store";
import { postJson } from "@/lib/api";

type Phase = "idle" | "listening" | "thinking" | "speaking";

export default function VoiceTab({ userId }: { userId: string | null }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<"guide" | "explain">("guide");
  const [handsFree, setHandsFree] = useState(true);
  const [heard, setHeard] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [engine, setEngine] = useState<"elevenlabs" | "browser" | null>(null);

  // Live audio amplitude, 0..1 — read by the orb in its own rAF loop.
  const levelRef = useRef(0);
  const speakerRef = useRef<Speaker | null>(null);

  const recRef = useRef<Recognition | null>(null);
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const finalRef = useRef("");
  const msgsRef = useRef<ChatMsg[]>([]);
  const sessionId = useRef<string | null>(null);
  const handsFreeRef = useRef(handsFree);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, heard]);

  useEffect(() => {
    setSupported(recognitionCtor() !== null);

    // The voice list arrives asynchronously. Waiting for it is the difference
    // between a neural voice and the browser's robotic default.
    let alive = true;
    loadVoices().then((all) => {
      if (!alive) return;
      const ranked = rankedVoices(all, navigator.language || "en-US");
      setVoices(ranked);
      let saved: string | null = null;
      try { saved = window.localStorage.getItem("tm.voice"); } catch { /* ignore */ }
      const chosen = pickVoice(all, saved, navigator.language || "en-US");
      if (chosen) setVoiceURI(chosen.voiceURI);
    });
    return () => { alive = false; };
  }, []);

  const stopAll = useCallback(() => {
    recRef.current?.abort();
    recRef.current = null;
    speakerRef.current?.stop();
    speakerRef.current = null;
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    levelRef.current = 0;
    window.speechSynthesis?.cancel();
    setPhase("idle");
    setHeard("");
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const speak = useCallback(
    (text: string, then: () => void) => {
      const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
      setPhase("speaking");

      speakerRef.current?.stop();
      const speaker = speakOut(text, {
        voice,
        onEngine: setEngine,
        onDone: () => { levelRef.current = 0; then(); },
      });
      speakerRef.current = speaker;
      levelRef.current = 0;

      // Mirror the speaker's level into the ref the orb watches.
      const pump = () => {
        if (speakerRef.current !== speaker) return;
        levelRef.current = speaker.level.current;
        requestAnimationFrame(pump);
      };
      pump();

      stopSpeechRef.current = () => speaker.stop();
    },
    [voices, voiceURI],
  );

  const ask = useCallback(
    async (text: string) => {
      setPhase("thinking");
      setError(null);

      const history: ChatMsg[] = [...msgsRef.current, { role: "user", content: text }];
      setMsgs(history);

      try {
        const data = await postJson<{ reply: string }>("/api/tutor", {
          messages: history.map(({ role, content }) => ({ role, content })),
          mode,
          voice: true,
        });

        const all: ChatMsg[] = [...history, { role: "assistant", content: data.reply }];
        setMsgs(all);

        void save("sessions", userId, {
          id: sessionId.current ?? undefined,
          mode,
          source: "voice",
          subject: null,
          problem: all[0]?.content ?? null,
          title: (all[0]?.content ?? "Voice session").slice(0, 70),
          messages: all,
        } as never).then((row) => { sessionId.current = (row as { id: string }).id; });

        speak(data.reply, () => {
          if (handsFreeRef.current) startListening();
          else setPhase("idle");
        });
      } catch (e) {
        setError((e as Error).message);
        setPhase("idle");
      }
    },
    // startListening is defined below and stable via ref-free closure over state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, speak, userId],
  );

  const startListening = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return setSupported(false);

    window.speechSynthesis?.cancel();
    recRef.current?.abort();

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    finalRef.current = "";
    setHeard("");
    setError(null);

    rec.onstart = () => setPhase("listening");

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setHeard((finalRef.current + interim).trim());
    };

    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === "no-speech") { setPhase("idle"); return; }
      setError(
        e.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser settings."
          : "Didn't catch that. Tap and try again.",
      );
      setPhase("idle");
    };

    rec.onend = () => {
      recRef.current = null;
      const said = finalRef.current.trim();
      if (said) { setHeard(""); void ask(said); }
      else setPhase((p) => (p === "listening" ? "idle" : p));
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  }, [ask]);

  const label =
    phase === "listening" ? "Listening" :
    phase === "thinking" ? "Thinking" :
    phase === "speaking" ? "Talking" :
    msgs.length ? "Tap to reply" : "Tap and say what you're stuck on";

  if (!supported) {
    return (
      <div className="card center">
        <h2 className="mt12" style={{ fontSize: 18 }}>Voice needs a different browser</h2>
        <p className="small muted mt8">
          Speech recognition works in Safari on iPhone and Chrome on Android and desktop.
          Firefox doesn&apos;t support it. Chat mode works everywhere.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="seg">
        <button className={mode === "guide" ? "on" : ""} onClick={() => setMode("guide")}>Guide me</button>
        <button className={mode === "explain" ? "on" : ""} onClick={() => setMode("explain")}>Explain it</button>
      </div>

      <div className="card center mt16">

        <Orb
          state={phase}
          levelRef={levelRef}
          label={label}
          onClick={() => {
            if (phase === "idle") startListening();
            else if (phase === "speaking") {
              speakerRef.current?.stop();
              speakerRef.current = null;
              levelRef.current = 0;
              setPhase("idle");
            } else stopAll();
          }}
        >
          {phase === "idle" ? <VoiceIcon /> : <StopIcon />}
        </Orb>

        <p className="mt16" style={{ fontWeight: 620 }}>{label}</p>
        {heard && <p className="small muted mt8">&ldquo;{heard}&rdquo;</p>}
        {error && <p className="small mt8" style={{ color: "#A32E25" }}>{error}</p>}

        {engine === "browser" && voices.length > 1 && (
          <label className="field mt20" style={{ textAlign: "left" }}>
            <span>Voice</span>
            <select
              className="input"
              value={voiceURI ?? ""}
              onChange={(e) => {
                setVoiceURI(e.target.value);
                try { window.localStorage.setItem("tm.voice", e.target.value); } catch { /* ignore */ }
                // Say a line in the new voice so the choice is audible.
                const v = voices.find((x) => x.voiceURI === e.target.value) ?? null;
                stopSpeechRef.current?.();
                stopSpeechRef.current = speakNaturally("Okay. Where did you get to?", v);
              }}
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name.replace(/\s*\([^)]*\)\s*$/, "")}
                </option>
              ))}
            </select>
            <span className="tiny muted" style={{ fontWeight: 500, marginTop: 6, display: "block" }}>
              Best first. The most natural ones need a connection.
            </span>
          </label>
        )}

        <label className="row mt16" style={{ justifyContent: "center", gap: 8, fontSize: 13.5 }}>
          <input
            type="checkbox"
            checked={handsFree}
            onChange={(e) => setHandsFree(e.target.checked)}
            style={{ width: 17, height: 17, accentColor: "#24B48F" }}
          />
          <span className="muted">Keep listening between replies</span>
        </label>
      </div>

      {msgs.length > 0 && (
        <>
          <div className="row-between mt20">
            <h3 style={{ fontSize: 15 }}>Transcript</h3>
            <button
              className="btn sm ghost"
              onClick={() => { stopAll(); setMsgs([]); sessionId.current = null; }}
            >
              <CloseIcon /> Clear
            </button>
          </div>
          <div className="thread mt12">
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
                <p>{m.content}</p>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </>
      )}
    </>
  );
}
