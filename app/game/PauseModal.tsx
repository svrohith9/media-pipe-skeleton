"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import GlassCard from "../../components/GlassCard";
import NeonButton from "../../components/NeonButton";

const slideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: "easeIn" } },
};

export type PauseModalProps = {
  isOpen: boolean;
  reason: string;
  onResume: () => void;
  onRecalibrate: () => void;
  onQuit: () => void;
};

export default function PauseModal({
  isOpen,
  reason,
  onResume,
  onRecalibrate,
  onQuit,
}: PauseModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={slideUp}
        >
          <GlassCard className="relative w-[min(480px,90vw)] overflow-hidden text-center">
            <Image
              src="/assets/pause.png"
              alt="Pause reference"
              fill
              sizes="(max-width: 768px) 90vw, 480px"
              className="object-cover opacity-20"
            />
            <div className="relative z-10">
            <div className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Paused
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-cyan-200">
              {reason}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Restore your camera feed to continue running.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <NeonButton onClick={onResume}>Resume</NeonButton>
              <NeonButton onClick={onRecalibrate}>Recalibrate</NeonButton>
              <button
                className="rounded-full border border-slate-600/60 px-4 py-2 text-sm text-slate-300"
                onClick={onQuit}
              >
                Quit
              </button>
            </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
