"use client";

import { useEffect, useRef } from "react";
import { usePoseStore } from "../store/poseStore";
import { drawSkeleton } from "../lib/renderUtils";

export default function SkeletonOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keypoints = usePoseStore((state) => state.keypoints);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("[Skeleton] Canvas ref missing");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("[Skeleton] Canvas context null");
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (keypoints.length > 0) {
        console.log("[Skeleton] Drawing", keypoints.length, "keypoints");
        drawSkeleton(keypoints, ctx, 0.5, 0.5);
      } else {
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        ctx.fillRect(10, 10, 160, 22);
        ctx.fillStyle = "white";
        ctx.font = "12px monospace";
        ctx.fillText("NO POSE DETECTED", 16, 26);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [keypoints]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={180}
      className="fixed right-4 top-4 z-50 rounded border-2 border-cyan-400 bg-black/60"
      data-testid="skeleton-canvas"
    />
  );
}
