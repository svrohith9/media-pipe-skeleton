import { create } from "zustand";
import type { CameraStatus } from "../hooks/useCamera";

export type DiagnosticState = {
  cameraStatus: CameraStatus;
  fps: number;
  lastGesture: "jump" | "flap" | "idle";
  setCameraStatus: (status: CameraStatus) => void;
  setFps: (fps: number) => void;
  setLastGesture: (gesture: "jump" | "flap" | "idle") => void;
};

export const useDiagnosticStore = create<DiagnosticState>((set) => ({
  cameraStatus: "idle",
  fps: 0,
  lastGesture: "idle",
  setCameraStatus: (cameraStatus) => set({ cameraStatus }),
  setFps: (fps) => set({ fps }),
  setLastGesture: (lastGesture) => set({ lastGesture }),
}));
