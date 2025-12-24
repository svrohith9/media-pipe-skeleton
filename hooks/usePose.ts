"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PoseKeypoint } from "../lib/pose";
import {
  getShoulderKeypoint,
  getWristKeypoint,
  normalizeY,
  smoothKeypoints,
} from "../lib/pose";
import { KalmanFilter1D } from "../lib/kalmanFilter1D";
import { useGameStore } from "../store/gameStore";
import { useMounted } from "./useMounted";

type WorkerPoseMessage = {
  type: "pose";
  keypoints: PoseKeypoint[];
  timestamp: number;
};

type WorkerErrorMessage = {
  type: "error";
  message: string;
};

type UsePoseOptions = {
  enabled?: boolean;
  onError?: (message: string) => void;
};

type PoseResult = {
  keypoints: PoseKeypoint[];
  hasPose: boolean;
  hasWrist: boolean;
  wristScore: number;
  shoulderNormalizedY: number;
  isModelReady: boolean;
  cameraStatus: "idle" | "ready" | "denied";
  fps: number;
  wrist: PoseKeypoint | null;
  wristFiltered: { x: number; y: number } | null;
  wristFilteredNormalizedY: number;
  wristNormalizedY: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  resolution: { width: number; height: number };
};

export function usePose(options: UsePoseOptions = {}): PoseResult {
  const { enabled = true, onError } = options;
  const isE2E = useMemo(() => process.env.NEXT_PUBLIC_E2E === "1", []);
  const setKeypoints = useGameStore((state) => state.setKeypoints);
  const [keypoints, setLocalKeypoints] = useState<PoseKeypoint[]>([]);
  const [hasPose, setHasPose] = useState(false);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState({ width: 640, height: 360 });
  const [isModelReady, setIsModelReady] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<
    "idle" | "ready" | "denied"
  >("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const lastKeypointsRef = useRef<PoseKeypoint[] | null>(null);
  const lastSentRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const frameCounterRef = useRef(0);
  const lowResAppliedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const kalmanXRef = useRef<KalmanFilter1D | null>(null);
  const kalmanYRef = useRef<KalmanFilter1D | null>(null);
  const lastRenderRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useMounted();

  const reportError = useCallback(
    (message: string) => {
      if (lastErrorRef.current === message) {
        return;
      }
      lastErrorRef.current = message;
      console.error("[GameError]", message);
      onError?.(message);
    },
    [onError]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isE2E) {
      return;
    }

    const workerUrl =
      process.env.NEXT_PUBLIC_WORKER_URL ??
      new URL("../workers/pose.worker.ts", import.meta.url).toString();
    const worker = new Worker(workerUrl, {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerPoseMessage | WorkerErrorMessage>) => {
      if (!mountedRef.current) {
        return;
      }
      if (event.data.type === "pose") {
        if (!isModelReady) {
          setIsModelReady(true);
        }
        const smoothed = smoothKeypoints(lastKeypointsRef.current, event.data.keypoints);
        lastKeypointsRef.current = smoothed;
        setKeypoints(smoothed);
        if (event.data.timestamp - lastRenderRef.current > 66) {
          lastRenderRef.current = event.data.timestamp;
          setLocalKeypoints(smoothed);
        }
        setHasPose(smoothed.some((point) => point.score > 0.05));
      } else if (event.data.type === "error") {
        reportError(event.data.message);
      }
    };

    worker.onerror = (event) => {
      reportError(event.message);
    };

    return () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, mountedRef, reportError, setKeypoints]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isE2E) {
      return;
    }

    const init = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraStatus("denied");
          reportError("Camera API not supported.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: resolution.width,
            height: resolution.height,
          },
          audio: false,
        });

        if (!mountedRef.current) {
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraStatus("ready");
        }
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        setCameraStatus("denied");
        reportError("Camera permissions denied or unavailable.");
      }
    };

    init();

    return () => {
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled, reportError, resolution.height, resolution.width]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isE2E) {
      return;
    }

    let raf = 0;

    const loop = (time: number) => {
      const worker = workerRef.current;
      const video = videoRef.current;
      if (!worker || !video) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (!captureRef.current) {
        captureRef.current = document.createElement("canvas");
      }

      const canvas = captureRef.current;
      canvas.width = resolution.width;
      canvas.height = resolution.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (time - lastSentRef.current > 33 && video.readyState >= 2 && !inFlightRef.current) {
        inFlightRef.current = true;
        lastSentRef.current = time;
        if (typeof createImageBitmap === "function") {
          createImageBitmap(video)
            .then((bitmap) => {
              worker.postMessage(
                {
                  type: "frame",
                  bitmap,
                  width: resolution.width,
                  height: resolution.height,
                },
                [bitmap]
              );
            })
            .catch((error) => {
              reportError(error instanceof Error ? error.message : "Frame capture failed.");
            })
            .finally(() => {
              inFlightRef.current = false;
            });
        } else {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          worker.postMessage({
            type: "frame",
            imageData,
            width: resolution.width,
            height: resolution.height,
          });
          inFlightRef.current = false;
        }
      }

      frameCounterRef.current += 1;
      if (time - lastFpsUpdateRef.current > 1000) {
        const nextFps = Math.round(
          (frameCounterRef.current * 1000) / (time - lastFpsUpdateRef.current)
        );
        setFps(nextFps);
        frameCounterRef.current = 0;
        lastFpsUpdateRef.current = time;

        if (nextFps < 55 && !lowResAppliedRef.current) {
          lowResAppliedRef.current = true;
          setResolution({ width: 320, height: 180 });
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [enabled, resolution.height, resolution.width]);

  useEffect(() => {
    if (!enabled || !isE2E) {
      return;
    }

    window.__setMockPose = (nextKeypoints: PoseKeypoint[]) => {
      setKeypoints(nextKeypoints);
      setLocalKeypoints(nextKeypoints);
      setHasPose(nextKeypoints.some((point) => point.score > 0.05));
      setIsModelReady(true);
    };

    return () => {
      window.__setMockPose = undefined;
    };
  }, [enabled, isE2E, setKeypoints]);

  const wrist = getWristKeypoint(keypoints);
  const wristScore = wrist?.score ?? 0;
  const hasWrist = wristScore > 0.05;
  const shoulder = getShoulderKeypoint(keypoints);
  const wristNormalizedY = wrist
    ? normalizeY(wrist.y, resolution.height)
    : 0;
  const shoulderNormalizedY = shoulder
    ? normalizeY(shoulder.y, resolution.height)
    : 0;

  useEffect(() => {
    if (!wrist) {
      return;
    }

    if (!kalmanXRef.current) {
      kalmanXRef.current = new KalmanFilter1D(wrist.x, {
        processNoise: 2,
        measurementNoise: 10,
        estimatedError: 1,
      });
    }

    if (!kalmanYRef.current) {
      kalmanYRef.current = new KalmanFilter1D(wrist.y, {
        processNoise: 2,
        measurementNoise: 10,
        estimatedError: 1,
      });
    }

  }, [wrist]);

  const wristFiltered = wrist
    ? {
        x: kalmanXRef.current?.update(wrist.x) ?? wrist.x,
        y: kalmanYRef.current?.update(wrist.y) ?? wrist.y,
      }
    : null;
  const wristFilteredNormalizedY = wristFiltered
    ? normalizeY(wristFiltered.y, resolution.height)
    : 0;

  return {
    keypoints,
    hasPose,
    hasWrist,
    wristScore,
    shoulderNormalizedY,
    isModelReady,
    cameraStatus,
    fps,
    wrist,
    wristFiltered,
    wristFilteredNormalizedY,
    wristNormalizedY,
    videoRef,
    overlayRef,
    resolution,
  };
}

declare global {
  interface Window {
    __setMockPose?: (keypoints: PoseKeypoint[]) => void;
  }
}
