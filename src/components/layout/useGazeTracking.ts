"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Opt-in, on-device webcam eye tracking for the footer icon effect (owner
 * asked to try it 2026-09-07, after being told about the camera-permission
 * and Law 25 tradeoffs vs. the cursor-based version in useLookAtCursor).
 *
 * Runs MediaPipe's FaceLandmarker entirely in the browser (WASM/GPU) —
 * nothing is uploaded anywhere. Only starts on explicit start() from a user
 * click; never auto-requests the camera. Always call stop() to release the
 * camera — it is not released automatically except on unmount.
 *
 * Gaze estimate is iris position relative to each eye's own corners/lids,
 * i.e. where the eyes point within the sockets — not a calibrated point on
 * screen. Good enough to lean icons toward "you're looking left/right/up/down",
 * not precise enough to target a specific pixel.
 */
export type Gaze = { x: number; y: number } | null; // both in [-1, 1]

// MediaPipe FaceMesh landmark indices (478-point model with iris refinement).
const L_IRIS = 468;
const L_OUTER = 33;
const L_INNER = 133;
const L_TOP = 159;
const L_BOTTOM = 145;
const R_IRIS = 473;
const R_OUTER = 263;
const R_INNER = 362;
const R_TOP = 386;
const R_BOTTOM = 374;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function eyeGaze(
  iris: { x: number; y: number },
  outer: { x: number; y: number },
  inner: { x: number; y: number },
  top: { x: number; y: number },
  bottom: { x: number; y: number },
) {
  const width = inner.x - outer.x;
  const height = bottom.y - top.y;
  const x = width !== 0 ? ((iris.x - outer.x) / width - 0.5) * 2 : 0;
  const y = height !== 0 ? ((iris.y - top.y) / height - 0.5) * 2 : 0;
  return { x, y };
}

function estimateGaze(landmarks: { x: number; y: number }[]): Gaze {
  const l = eyeGaze(landmarks[L_IRIS], landmarks[L_OUTER], landmarks[L_INNER], landmarks[L_TOP], landmarks[L_BOTTOM]);
  const r = eyeGaze(landmarks[R_IRIS], landmarks[R_OUTER], landmarks[R_INNER], landmarks[R_TOP], landmarks[R_BOTTOM]);

  // Webcam feed is a selfie view (mirrored), so flip x: looking to your
  // right should lean icons to their right too.
  const x = -((l.x + r.x) / 2);
  const y = (l.y + r.y) / 2;

  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}

export function useGazeTracking() {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gaze, setGaze] = useState<Gaze>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current?.pause();
    videoRef.current = null;
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
    setActive(false);
    setGaze(null);
  }, []);

  const start = useCallback(async () => {
    if (active || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      landmarkerRef.current = landmarker;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      setActive(true);
      setLoading(false);

      const loop = () => {
        const v = videoRef.current;
        const lm = landmarkerRef.current;
        if (v && lm && v.readyState >= 2) {
          const result = lm.detectForVideo(v, performance.now());
          const face = result.faceLandmarks?.[0];
          setGaze(face ? estimateGaze(face) : null);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera permission was denied."
          : "Couldn't start eye tracking. Your browser or device may not support it.",
      );
      setLoading(false);
      stop();
    }
  }, [active, loading, stop]);

  // Always release the camera if the component unmounts while active.
  useEffect(() => stop, [stop]);

  return { active, loading, error, gaze, start, stop };
}
