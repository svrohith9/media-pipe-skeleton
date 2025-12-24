"use client";

import { motion, useSpring, type MotionValue } from "framer-motion";

export type PlayerProps = {
  y: MotionValue<number>;
  squish: MotionValue<number>;
};

export default function Player({ y, squish }: PlayerProps) {
  const springY = useSpring(y, { stiffness: 1200, damping: 25 });
  return (
    <motion.div
      style={{ translateY: springY, scaleY: squish }}
      data-testid="player"
      className="absolute bottom-12 left-24 h-16 w-16 rounded-xl border border-cyan-300/70 bg-slate-900/80 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
    >
      <div className="absolute inset-0 rounded-xl border border-fuchsia-500/30" />
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-tr from-cyan-400/30 to-fuchsia-500/30 blur-md" />
    </motion.div>
  );
}
