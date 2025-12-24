"use client";

import { AnimatePresence, motion } from "framer-motion";

const slideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: "easeIn" } },
};

export type ErrorToastProps = {
  message: string | null;
};

export default function ErrorToast({ message }: ErrorToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed bottom-6 left-1/2 z-[1000] w-[min(360px,90vw)] -translate-x-1/2 rounded-xl bg-black/80 px-4 py-3 text-sm text-slate-200"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={slideUp}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
