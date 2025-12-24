import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GameState = {
  score: number;
  combo: number;
  highScore: number;
  preferKeyboard: boolean;
  status: "RUNNING" | "PAUSED" | "GAME_OVER" | "CALIBRATING" | "POSE_LOST";
  fps: number;
  setScore: (score: number) => void;
  setCombo: (combo: number) => void;
  setHighScore: (score: number) => void;
  resetScore: () => void;
  setPreferKeyboard: (value: boolean) => void;
  setStatus: (status: GameState["status"]) => void;
  setFps: (fps: number) => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      score: 0,
      combo: 1,
      highScore: 0,
      preferKeyboard: false,
      status: "CALIBRATING",
      fps: 0,
      setScore: (score) => set({ score }),
      setCombo: (combo) => set({ combo }),
      setHighScore: (highScore) => set({ highScore }),
      resetScore: () => set({ score: 0, combo: 1 }),
      setPreferKeyboard: (preferKeyboard) => set({ preferKeyboard }),
      setStatus: (status) => set({ status }),
      setFps: (fps) => set({ fps }),
    }),
    {
      name: "camera-runner-game",
      partialize: (state) => ({
        highScore: state.highScore,
        preferKeyboard: state.preferKeyboard,
      }),
    }
  )
);
