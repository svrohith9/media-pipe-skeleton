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
  isTracking: boolean;
  error: string | null;
  setKeypoints: (keypoints: PoseKeypoint[], timestamp: number) => void;
  setThresholds: (thresholds: PoseThresholds | null) => void;
  setCalibrationStats: (stats: CalibrationStats | null) => void;
  setPoseStale: (stale: boolean) => void;
  setError: (error: string | null) => void;
};

export const usePoseStore = create<PoseStoreState>()(
  persist(
    (set) => ({
      keypoints: [],
      thresholds: null,
      calibrationStats: null,
      lastPoseTimestamp: 0,
      isPoseStale: false,
      isTracking: false,
      error: null,
      setKeypoints: (keypoints, timestamp) => {
        console.log("[Store] setKeypoints:", keypoints.length);
        set({
          keypoints,
          lastPoseTimestamp: timestamp,
          isPoseStale: false,
          isTracking: keypoints.length > 0,
          error: null,
        });
      },
      setThresholds: (thresholds) => set({ thresholds }),
      setCalibrationStats: (calibrationStats) => set({ calibrationStats }),
      setPoseStale: (stale) => set({ isPoseStale: stale }),
      setError: (error) => {
        console.error("[Store] setError:", error);
        set({ error, isTracking: false });
      },
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
