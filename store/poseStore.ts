import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PoseKeypoint } from "../lib/pose";
import type { PoseThresholds } from "../lib/gesture";
export type CalibrationStats = {
  lowMean: number;
  lowStd: number;
  highMean: number;
  highStd: number;
};

export type PoseStoreState = {
  keypoints: PoseKeypoint[];
  thresholds: PoseThresholds | null;
  calibrationStats: CalibrationStats | null;
  lastPoseTimestamp: number;
  isPoseStale: boolean;
  setKeypoints: (keypoints: PoseKeypoint[], timestamp: number) => void;
  setThresholds: (thresholds: PoseThresholds | null) => void;
  setCalibrationStats: (stats: CalibrationStats | null) => void;
  setPoseStale: (stale: boolean) => void;
};

export const usePoseStore = create<PoseStoreState>()(
  persist(
    (set) => ({
      keypoints: [],
      thresholds: null,
      calibrationStats: null,
      lastPoseTimestamp: 0,
      isPoseStale: false,
      setKeypoints: (keypoints, timestamp) =>
        set({ keypoints, lastPoseTimestamp: timestamp, isPoseStale: false }),
      setThresholds: (thresholds) => set({ thresholds }),
      setCalibrationStats: (calibrationStats) => set({ calibrationStats }),
      setPoseStale: (stale) => set({ isPoseStale: stale }),
    }),
    {
      name: "camera-runner-pose",
      partialize: (state) => ({
        thresholds: state.thresholds,
        calibrationStats: state.calibrationStats,
      }),
    }
  )
);
