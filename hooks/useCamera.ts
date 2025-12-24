"use client";

import { useCallback, useEffect, useState } from "react";
import { useMounted } from "./useMounted";

export type CameraStatus = "idle" | "ready" | "denied" | "loading";

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mountedRef = useMounted();

  const getCameraStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("denied");
      return null;
    }

    try {
      setStatus("loading");
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        return null;
      }

      setStream(nextStream);
      setStatus("ready");
      return nextStream;
    } catch (error) {
      if (!mountedRef.current) {
        return null;
      }
      setStatus("denied");
      return null;
    }
  }, [mountedRef]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return { status, stream, getCameraStream };
}
