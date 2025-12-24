"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import GlassCard from "../../components/GlassCard";
import { type PoseThresholds } from "../../lib/gesture";

const CAPTURE_FRAMES = 30;

type Phase = "down" | "up" | "done";

export type CalibrationProps = {
  hasPose: boolean;
  hasWrist: boolean;
  isModelReady: boolean;
  wristNormalizedY: number;
  onComplete: (thresholds: PoseThresholds) => void;
  onSkip: () => void;
  onError?: (message: string) => void;
};

const slideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: "easeIn" } },
};

export default function Calibration({
  hasPose,
  hasWrist,
  isModelReady,
  wristNormalizedY,
  onComplete,
  onSkip,
  onError,
}: CalibrationProps) {
  const [phase, setPhase] = useState<Phase>("down");
  const downSamplesRef = useRef<number[]>([]);
  const upSamplesRef = useRef<number[]>([]);
  const [progress, setProgress] = useState(0);
  const phaseRef = useRef<Phase>("down");
  const lastSampleRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase === "done") {
      return;
    }

    let raf = 0;
    const sample = (time: number) => {
      if (phaseRef.current === "done" || !isModelReady) {
        return;
      }

      if (time - lastSampleRef.current > 120) {
        lastSampleRef.current = time;

        if (hasPose && (hasWrist || wristNormalizedY > 0)) {
          const currentPhase = phaseRef.current;
          if (currentPhase === "down") {
            downSamplesRef.current.push(wristNormalizedY);
            const nextProgress =
              downSamplesRef.current.length / CAPTURE_FRAMES;
            setProgress(nextProgress);
            if (downSamplesRef.current.length >= CAPTURE_FRAMES) {
              setPhase("up");
            }
          } else if (currentPhase === "up") {
            upSamplesRef.current.push(wristNormalizedY);
            const nextProgress = upSamplesRef.current.length / CAPTURE_FRAMES;
            setProgress(nextProgress);
            if (upSamplesRef.current.length >= CAPTURE_FRAMES) {
              const idleThreshold =
                downSamplesRef.current.reduce((sum, value) => sum + value, 0) /
                Math.max(1, downSamplesRef.current.length);
              let jumpThreshold =
                upSamplesRef.current.reduce((sum, value) => sum + value, 0) /
                Math.max(1, upSamplesRef.current.length);
              if (jumpThreshold >= idleThreshold) {
                jumpThreshold = Math.max(0, idleThreshold - 0.06);
              }
              setPhase("done");
              setProgress(1);
              onComplete({ idleThreshold, jumpThreshold });
            }
          }
        }
      }
      raf = requestAnimationFrame(sample);
    };

    raf = requestAnimationFrame(sample);
    const timeout = window.setTimeout(() => {
      if (phaseRef.current === "done" || !isModelReady) {
        return;
      }

      const fallbackIdle =
        downSamplesRef.current.length > 0
          ? downSamplesRef.current.reduce((sum, value) => sum + value, 0) /
            downSamplesRef.current.length
          : 0.75;
      const fallbackJump =
        upSamplesRef.current.length > 0
          ? upSamplesRef.current.reduce((sum, value) => sum + value, 0) /
            upSamplesRef.current.length
          : 0.35;
      onError?.("Calibration timed out. Using fallback thresholds.");
      setPhase("done");
      setProgress(1);
      onComplete({ idleThreshold: fallbackIdle, jumpThreshold: fallbackJump });
    }, 20000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [hasPose, hasWrist, onComplete, onError, phase, wristNormalizedY]);

  return (
    <AnimatePresence>
      <motion.div
        data-testid="calibration"
        className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={slideUp}
      >
        <GlassCard className="w-[min(520px,90vw)] text-center">
          <div className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Calibration
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-cyan-200">
            {phase === "down" && "Hold your arm down"}
            {phase === "up" && "Raise to shoulder height"}
            {phase === "done" && "Calibrated!"}
          </h2>
        <p className="mt-2 text-sm text-slate-400">
          Stand about 1 meter from the camera and keep your arm steady.
        </p>
        {!isModelReady && (
          <p className="mt-3 text-xs text-slate-500">Loading pose model...</p>
        )}
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        <div className="mt-3 text-xs text-slate-500">
          {Math.round(progress * 100)}% captured
        </div>
        <button
          onClick={onSkip}
          className="mt-4 text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-cyan-200"
        >
          Use defaults
        </button>
      </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
