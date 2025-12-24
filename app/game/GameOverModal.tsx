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

export type GameOverModalProps = {
  isOpen: boolean;
  distance: number;
  highScore: number;
  onReplay: () => void;
  onRecalibrate: () => void;
};

export default function GameOverModal({
  isOpen,
  distance,
  highScore,
  onReplay,
  onRecalibrate,
}: GameOverModalProps) {
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
          <GlassCard className="relative w-[min(520px,90vw)] overflow-hidden text-center">
            <Image
              src="/assets/gameover.png"
              alt="Game over reference"
              fill
              sizes="(max-width: 768px) 90vw, 520px"
              className="object-cover opacity-20"
            />
            <div className="relative z-10">
            <div className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Game Over
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-cyan-200">
              Distance {distance}m
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              High score {highScore}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <NeonButton onClick={onReplay}>Play Again</NeonButton>
              <NeonButton onClick={onRecalibrate}>Recalibrate</NeonButton>
            </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
