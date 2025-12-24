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
import { usePoseStore } from "../store/poseStore";
import { useDiagnosticStore } from "../store/diagnosticStore";
import { useCamera } from "./useCamera";
import { useMounted } from "./useMounted";
import { usePoseDebugger } from "./usePoseDebugger";

type WorkerPoseMessage = {
  type: "POSES";
  payload: PoseKeypoint[];
  timestamp: number;
  maxScore?: number;
};

type WorkerErrorMessage = {
  type: "ERROR";
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
  cameraStatus: "idle" | "ready" | "denied" | "loading";
  fps: number;
  wrist: PoseKeypoint | null;
  wristFiltered: { x: number; y: number } | null;
  wristFilteredNormalizedY: number;
  wristNormalizedY: number;
  videoRef: React.RefObject<HTMLVideoElement>;
};

const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

export function usePose(options: UsePoseOptions = {}): PoseResult {
  const { enabled = true, onError } = options;
  const isE2E = useMemo(() => process.env.NEXT_PUBLIC_E2E === "1", []);
  const { status: cameraStatus, stream, getCameraStream } = useCamera();
  const mountedRef = useMounted();

  const setKeypoints = usePoseStore((state) => state.setKeypoints);
  const setPoseStale = usePoseStore((state) => state.setPoseStale);
  const lastPoseTimestamp = usePoseStore((state) => state.lastPoseTimestamp);
  const setCameraStatus = useDiagnosticStore((state) => state.setCameraStatus);
  const setFpsDiagnostic = useDiagnosticStore((state) => state.setFps);

  const [keypoints, setLocalKeypoints] = useState<PoseKeypoint[]>([]);
  const [hasPose, setHasPose] = useState(false);
  const [fps, setFps] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const lastKeypointsRef = useRef<PoseKeypoint[] | null>(null);
  const lastSentRef = useRef(0);
  const lastWorkerMessageRef = useRef(0);
  const lastWorkerRestartRef = useRef(0);
  const workerStartRef = useRef(0);
  const noPoseFramesRef = useRef(0);
  const frameCounterRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const kalmanXRef = useRef<KalmanFilter1D | null>(null);
  const kalmanYRef = useRef<KalmanFilter1D | null>(null);
  const preflightStartedRef = useRef(false);

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
    if (!enabled || isE2E) {
      return;
    }
    if (preflightStartedRef.current) {
      return;
    }
    preflightStartedRef.current = true;

    void getCameraStream();
  }, [enabled, getCameraStream, isE2E]);

  useEffect(() => {
    if (!enabled || isE2E) {
      return;
    }
    if (cameraStatus === "idle" && !stream) {
      void getCameraStream();
    }
  }, [cameraStatus, enabled, getCameraStream, isE2E, stream]);

  useEffect(() => {
    if (!stream || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      reportError(error instanceof Error ? error.message : "Video play failed.");
    });
  }, [reportError, stream]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    setCameraStatus(cameraStatus);
  }, [cameraStatus, enabled, setCameraStatus]);

  useEffect(() => {
    if (!enabled || isE2E) {
      return;
    }

    const createWorker = () => {
      const worker = new Worker(
        new URL("../app/workers/pose.worker.ts", import.meta.url),
        {
          type: "module",
        }
      );
      workerRef.current = worker;
      const now = performance.now();
      lastWorkerMessageRef.current = now;
      workerStartRef.current = now;

      worker.onmessage = (
        event: MessageEvent<WorkerPoseMessage | WorkerErrorMessage>
      ) => {
        if (!mountedRef.current) {
          return;
        }
        lastWorkerMessageRef.current = performance.now();
        if (event.data.type === "POSES") {
          if (!isModelReady) {
            setIsModelReady(true);
          }
          const score = event.data.maxScore ?? 0;
          if (score < 0.2) {
            noPoseFramesRef.current += 1;
            setHasPose(false);
            setKeypoints([], event.data.timestamp);
            setLocalKeypoints([]);
            if (noPoseFramesRef.current > 120) {
              console.warn("[GameError] No pose detected. Restarting worker.");
              workerRef.current?.terminate();
              workerRef.current = null;
              setIsModelReady(false);
              noPoseFramesRef.current = 0;
              createWorker();
            }
            return;
          }
          noPoseFramesRef.current = 0;
          const smoothed = smoothKeypoints(
            lastKeypointsRef.current,
            event.data.payload
          );
          lastKeypointsRef.current = smoothed;
          setKeypoints(smoothed, event.data.timestamp);
          setLocalKeypoints(smoothed);
          setHasPose(smoothed.length > 0);
        } else if (event.data.type === "ERROR") {
          reportError(event.data.message);
        }
      };

      worker.onerror = (event) => {
        reportError(event.message);
      };

      return worker;
    };

    const worker = createWorker();

    const watchdog = window.setInterval(() => {
      if (!workerRef.current || cameraStatus !== "ready") {
        return;
      }
      const now = performance.now();
      if (now - workerStartRef.current < 8000) {
        return;
      }
      if (now - lastWorkerMessageRef.current > 3500) {
        if (now - lastWorkerRestartRef.current < 1000) {
          return;
        }
        lastWorkerRestartRef.current = now;
        workerRef.current?.terminate();
        workerRef.current = null;
        setIsModelReady(false);
        console.warn("[GameError] Pose worker stalled. Restarting.");
        createWorker();
      }
    }, 500);

    return () => {
      window.clearInterval(watchdog);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, [
    cameraStatus,
    enabled,
    isE2E,
    isModelReady,
    mountedRef,
    reportError,
    setKeypoints,
  ]);

  useEffect(() => {
    if (!enabled || isE2E) {
      return;
    }

    let raf = 0;
    const loop = (time: number) => {
      const worker = workerRef.current;
      const video = videoRef.current;
      if (!worker || !video || video.readyState < 2) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      if (videoWidth === 0 || videoHeight === 0) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (time - lastSentRef.current > 33 && !inFlightRef.current) {
        inFlightRef.current = true;
        lastSentRef.current = time;
        lastWorkerMessageRef.current = time;
        createImageBitmap(video)
          .then((bitmap) => {
            worker.postMessage(
              {
                type: "FRAME",
                bitmap,
                width: videoWidth,
                height: videoHeight,
                timestamp: time,
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
      }

      frameCounterRef.current += 1;
      if (time - lastFpsUpdateRef.current > 1000) {
        const nextFps = Math.round(
          (frameCounterRef.current * 1000) / (time - lastFpsUpdateRef.current)
        );
        setFps(nextFps);
        setFpsDiagnostic(nextFps);
        frameCounterRef.current = 0;
        lastFpsUpdateRef.current = time;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [enabled, isE2E, reportError, setFpsDiagnostic]);

  useEffect(() => {
    if (!enabled || !isE2E) {
      return;
    }

    window.__setMockPose = (nextKeypoints: PoseKeypoint[]) => {
      setKeypoints(nextKeypoints, performance.now());
      setLocalKeypoints(nextKeypoints);
      setHasPose(nextKeypoints.some((point) => point.score > 0.05));
      setIsModelReady(true);
    };

    return () => {
      window.__setMockPose = undefined;
    };
  }, [enabled, isE2E, setKeypoints]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!lastPoseTimestamp) {
        return;
      }
      const stale = performance.now() - lastPoseTimestamp > 1000;
      setPoseStale(stale);
    }, 500);

    return () => window.clearInterval(interval);
  }, [enabled, lastPoseTimestamp, setPoseStale]);

  usePoseDebugger(keypoints, keypoints[0]?.y ?? 0, DEBUG_MODE);

  const wrist = getWristKeypoint(keypoints);
  const wristScore = wrist?.score ?? 0;
  const hasWrist = wristScore > 0.05;
  const shoulder = getShoulderKeypoint(keypoints);
  const wristNormalizedY = wrist
    ? normalizeY(wrist.y, videoRef.current?.videoHeight || 1)
    : 0;
  const shoulderNormalizedY = shoulder
    ? normalizeY(shoulder.y, videoRef.current?.videoHeight || 1)
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
    ? normalizeY(wristFiltered.y, videoRef.current?.videoHeight || 1)
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
  };
}

declare global {
  interface Window {
    __setMockPose?: (keypoints: PoseKeypoint[]) => void;
  }
}
