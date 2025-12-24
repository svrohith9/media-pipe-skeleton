"use client";

import { useGameStore } from "../../store/gameStore";

export type HudProps = {
  fps: number;
  preferKeyboard: boolean;
  onToggleControls: () => void;
  gestureIndicator: "jump" | "flap" | null;
  jumpReady: boolean;
};

export default function Hud({
  fps,
  preferKeyboard,
  onToggleControls,
  gestureIndicator,
  jumpReady,
}: HudProps) {
  const score = useGameStore((state) => state.score);
  const combo = useGameStore((state) => state.combo);

  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
      <div className="rounded-xl bg-glass px-4 py-2 text-sm text-cyan-200 shadow-neon">
        <div className="font-mono text-lg">{fps} fps</div>
        <div className="text-xs text-slate-400">auto-adjusting</div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="rounded-xl bg-glass px-4 py-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</div>
          <div className="font-mono text-2xl text-cyan-300">
            {Math.floor(score)}
          </div>
          <div className="text-xs text-slate-400">
            Combo x{combo.toFixed(1)}
          </div>
        </div>

        <button
          onClick={onToggleControls}
          className="rounded-full border border-slate-600/50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:text-cyan-200"
        >
          {preferKeyboard ? "Keyboard" : "Camera"}
        </button>

        <div className="flex items-center gap-3 rounded-full bg-glass px-4 py-2 text-xs text-slate-300">
          <span className="text-cyan-300">Indicators</span>
          <span
            className={`text-lg ${gestureIndicator === "jump" || jumpReady ? "text-cyan-300 animate-pulse" : "text-slate-600"}`}
          >
            ↑
          </span>
          <span
            className={`text-lg ${gestureIndicator === "flap" ? "text-fuchsia-400 animate-pulse" : "text-slate-600"}`}
          >
            〰
          </span>
        </div>
      </div>
    </div>
  );
}
