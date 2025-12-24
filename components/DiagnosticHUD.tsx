"use client";

import { useMemo } from "react";
import { usePoseStore } from "../store/poseStore";
import { useDiagnosticStore } from "../store/diagnosticStore";

export default function DiagnosticHUD() {
  const cameraStatus = useDiagnosticStore((state) => state.cameraStatus);
  const fps = useDiagnosticStore((state) => state.fps);
  const lastGesture = useDiagnosticStore((state) => state.lastGesture);
  const thresholds = usePoseStore((state) => state.thresholds);
  const lastPoseTimestamp = usePoseStore((state) => state.lastPoseTimestamp);
  const isPoseStale = usePoseStore((state) => state.isPoseStale);

  const secondsSincePose = useMemo(() => {
    if (!lastPoseTimestamp) {
      return 0;
    }
    return Math.max(0, (performance.now() - lastPoseTimestamp) / 1000);
  }, [lastPoseTimestamp]);

  return (
    <div className="fixed right-4 top-4 z-[1000] w-[220px] rounded-xl bg-black/80 px-4 py-3 text-xs text-slate-200">
      <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Diagnostics</div>
      <div className="mt-2 flex items-center justify-between">
        <span>Camera</span>
        <span>
          {cameraStatus === "ready" && "✅ Active"}
          {cameraStatus === "loading" && "⏳ Loading"}
          {cameraStatus === "denied" && "❌ Denied"}
          {cameraStatus === "idle" && "⏳ Idle"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>Pose</span>
        <span>{isPoseStale ? "❌ Lost" : "✅ Detected"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>Last seen</span>
        <span>{secondsSincePose.toFixed(1)}s ago</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>FPS</span>
        <span className={fps < 30 ? "text-red-400" : "text-cyan-200"}>{fps}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>Jump</span>
        <span>{thresholds?.jumpThreshold?.toFixed(2) ?? "--"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>Idle</span>
        <span>{thresholds?.idleThreshold?.toFixed(2) ?? "--"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>Gesture</span>
        <span>{lastGesture.toUpperCase()}</span>
      </div>
    </div>
  );
}
