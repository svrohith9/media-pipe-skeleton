"use client";

import { useGameStore } from "../store/gameStore";
import { usePoseStore } from "../store/poseStore";

export default function DebugPanel() {
  const poseStore = usePoseStore();
  const status = useGameStore((state) => state.status);
  const fps = useGameStore((state) => state.fps);

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-1 rounded bg-black/80 p-4 font-mono text-xs text-white">
      <div>Camera: {poseStore.isTracking ? "✅" : "❌"}</div>
      <div>Pose Points: {poseStore.keypoints.length}</div>
      <div>
        Last Update:{" "}
        {poseStore.lastPoseTimestamp
          ? `${Math.round(performance.now() - poseStore.lastPoseTimestamp)}ms ago`
          : "--"}
      </div>
      <div>Game State: {status}</div>
      <div>FPS: {fps}</div>
      {poseStore.error && <div>Error: {poseStore.error}</div>}
    </div>
  );
}
