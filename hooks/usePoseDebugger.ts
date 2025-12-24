import { useEffect } from "react";
import type { PoseKeypoint } from "../lib/pose";

export function usePoseDebugger(
  keypoints: PoseKeypoint[],
  wristY: number,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled || keypoints.length === 0) {
      return;
    }

    const confidence = keypoints.reduce((max, point) => Math.max(max, point.score), 0);
    console.log("[Pose]", {
      confidence: Number(confidence.toFixed(2)),
      wristY: Number(wristY.toFixed(2)),
    });
  }, [enabled, keypoints, wristY]);
}
