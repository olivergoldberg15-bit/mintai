"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Tutor from "./Tutor";
import { CameraIcon, ImageIcon, CloseIcon } from "./Icons";

/** Downscale before upload — free vision models choke on full-res phone photos. */
async function shrink(src: string, max = 1400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(src);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export default function ScanTab({ userId }: { userId: string | null }) {
  const [shot, setShot] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const openCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      // The <video> mounts with `live`, so attach on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (e) {
      const err = e as DOMException;
      setCamError(
        err.name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in your browser settings, or upload a photo instead."
          : err.name === "NotFoundError"
            ? "No camera found on this device. Upload a photo instead."
            : "Couldn't open the camera. Upload a photo instead.",
      );
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stop();
    setShot(await shrink(canvas.toDataURL("image/jpeg", 0.9)));
  };

  const pick = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => setShot(await shrink(String(reader.result)));
    reader.readAsDataURL(file);
  };

  const reset = () => {
    stop();
    setShot(null);
    setCamError(null);
  };

  if (shot) {
    return (
      <>
        <div className="row-between">
          <h2 style={{ fontSize: 17 }}>Your problem</h2>
          <button className="btn sm ghost" onClick={reset}>
            <CloseIcon /> New photo
          </button>
        </div>
        <div className="mt16">
          <Tutor source="scan" userId={userId} seed={{ image: shot }} />
        </div>
      </>
    );
  }

  return (
    <>
      {live ? (
        <>
          <div className="shot">
            <video ref={videoRef} playsInline muted autoPlay />
            <button className="shutter" onClick={capture} aria-label="Take photo" />
          </div>
          <button className="btn ghost block mt12" onClick={stop}>
            Cancel
          </button>
        </>
      ) : (
        <div className="fill-center">
          <div className="card center">
            <h2 className="mt12" style={{ fontSize: 17 }}>Scan a problem</h2>
            <p className="small muted mt8" style={{ maxWidth: 300, margin: "8px auto 0" }}>
              Point at the question. You&apos;ll get the questions that get you there — not the answer.
            </p>
          </div>

          {camError && <div className="banner mt12">{camError}</div>}

          <button className="btn block mt16" onClick={openCamera}>
            <CameraIcon /> Open camera
          </button>

          <button className="btn secondary block mt12" onClick={() => fileRef.current?.click()}>
            <ImageIcon /> Upload a photo
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </>
  );
}
