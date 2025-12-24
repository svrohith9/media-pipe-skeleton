import { create } from "zustand";
import type { PoseKeypoint } from "../lib/pose";
import type { PoseThresholds } from "../lib/gesture";

export type CalibrationStats = {
  lowMean: number;
  lowStd: number;
  highMean: number;
  highStd: number;
};

type GameSlice = {
  score: number;
  combo: number;
  highScore: number;
  preferKeyboard: boolean;
  setScore: (score: number) => void;
  setCombo: (combo: number) => void;
  setHighScore: (score: number) => void;
  resetScore: () => void;
  setPreferKeyboard: (value: boolean) => void;
};

type PoseSlice = {
  keypoints: PoseKeypoint[];
  thresholds: PoseThresholds | null;
  calibrationStats: CalibrationStats | null;
  setKeypoints: (keypoints: PoseKeypoint[]) => void;
  setThresholds: (thresholds: PoseThresholds | null) => void;
  setCalibrationStats: (stats: CalibrationStats | null) => void;
};

export const useGameStore = create<GameSlice & PoseSlice>((set) => ({
  score: 0,
  combo: 1,
  highScore: 0,
  preferKeyboard: false,
  keypoints: [],
  thresholds: null,
  calibrationStats: null,
  setScore: (score) => set({ score }),
  setCombo: (combo) => set({ combo }),
  setHighScore: (highScore) => set({ highScore }),
  resetScore: () => set({ score: 0, combo: 1 }),
  setPreferKeyboard: (preferKeyboard) => set({ preferKeyboard }),
  setKeypoints: (keypoints) => set({ keypoints }),
  setThresholds: (thresholds) => set({ thresholds }),
  setCalibrationStats: (calibrationStats) => set({ calibrationStats }),
}));
