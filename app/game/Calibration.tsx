"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import CalibrationRing from "../../components/CalibrationRing";
import GlassCard from "../../components/GlassCard";
import type { PoseThresholds } from "../../lib/gesture";
import type { CalibrationStats } from "../../store/gameStore";

const CAPTURE_FRAMES = 30;

type Phase = "low" | "high" | "done";

export type CalibrationResult = {
  thresholds: PoseThresholds;
  stats: CalibrationStats;
};

export type CalibrationProps = {
  hasPose: boolean;
  hasWrist: boolean;
  isModelReady: boolean;
  wristNormalizedY: number;
  onComplete: (result: CalibrationResult) => void;
  onSkip: () => void;
  onError?: (message: string) => void;
};

const slideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: "easeIn" } },
};

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const stdDev = (values: number[]) => {
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    Math.max(1, values.length);
  return Math.sqrt(variance);
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
  const [phase, setPhase] = useState<Phase>("low");
  const [lowProgress, setLowProgress] = useState(0);
  const [highProgress, setHighProgress] = useState(0);
  const lowSamplesRef = useRef<number[]>([]);
  const highSamplesRef = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("low");
  const lastSampleRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase === "done" || !isModelReady) {
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
          if (phaseRef.current === "low") {
            lowSamplesRef.current.push(wristNormalizedY);
            setLowProgress(lowSamplesRef.current.length / CAPTURE_FRAMES);
            if (lowSamplesRef.current.length >= CAPTURE_FRAMES) {
              setPhase("high");
            }
          } else if (phaseRef.current === "high") {
            highSamplesRef.current.push(wristNormalizedY);
            setHighProgress(highSamplesRef.current.length / CAPTURE_FRAMES);
            if (highSamplesRef.current.length >= CAPTURE_FRAMES) {
              const lowMean = mean(lowSamplesRef.current);
              const highMean = mean(highSamplesRef.current);
              const lowStd = stdDev(lowSamplesRef.current);
              const highStd = stdDev(highSamplesRef.current);
              let idleThreshold = lowMean + 0.3 * lowStd;
              let jumpThreshold = highMean - 0.3 * highStd;
              if (jumpThreshold >= idleThreshold) {
                jumpThreshold = Math.max(0.05, idleThreshold - 0.06);
              }
              setPhase("done");
              onComplete({
                thresholds: { idleThreshold, jumpThreshold },
                stats: {
                  lowMean,
                  lowStd,
                  highMean,
                  highStd,
                },
              });
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

      const lowMean = lowSamplesRef.current.length
        ? mean(lowSamplesRef.current)
        : 0.75;
      const highMean = highSamplesRef.current.length
        ? mean(highSamplesRef.current)
        : 0.35;
      const lowStd = lowSamplesRef.current.length
        ? stdDev(lowSamplesRef.current)
        : 0.08;
      const highStd = highSamplesRef.current.length
        ? stdDev(highSamplesRef.current)
        : 0.08;
      const idleThreshold = lowMean + 0.3 * lowStd;
      const jumpThreshold = Math.max(0.05, highMean - 0.3 * highStd);
      onError?.("Calibration timed out. Using fallback thresholds.");
      setPhase("done");
      onComplete({
        thresholds: { idleThreshold, jumpThreshold },
        stats: { lowMean, lowStd, highMean, highStd },
      });
    }, 20000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [hasPose, hasWrist, isModelReady, onComplete, onError, phase, wristNormalizedY]);

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
        <GlassCard className="relative w-[min(620px,92vw)] overflow-hidden text-center">
          <Image
            src="/assets/calibrate.png"
            alt="Calibration reference"
            fill
            priority
            sizes="(max-width: 768px) 90vw, 520px"
            className="object-cover opacity-20"
          />
          <div className="relative z-10">
          <div className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Calibration
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-cyan-200">
            Hold arm LOW -&gt; HIGH
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {phase === "done"
              ? "Calibrated!"
              : "Keep your wrist steady. We sample 30 frames for each pose."}
          </p>
          {!isModelReady && (
            <p className="mt-3 text-xs text-slate-500">Loading pose model...</p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
            <CalibrationRing
              label="Low"
              progress={lowProgress}
              active={phase === "low"}
            />
            <CalibrationRing
              label="High"
              progress={highProgress}
              active={phase === "high"}
            />
          </div>
          <button
            onClick={onSkip}
            className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-cyan-200"
          >
            Use defaults
          </button>
          </div>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
