import { useId } from "react";
import { cx } from "../lib/utils";

export type CalibrationRingProps = {
  progress: number;
  label: string;
  active?: boolean;
  className?: string;
};

export default function CalibrationRing({
  progress,
  label,
  active = false,
  className,
}: CalibrationRingProps) {
  const gradientId = useId();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className={cx("flex flex-col items-center gap-2", className)}>
      <svg width="110" height="110" className="drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]">
        <circle
          cx="55"
          cy="55"
          r={radius}
          stroke="#0f172a"
          strokeWidth="10"
          fill="transparent"
        />
        <circle
          cx="55"
          cy="55"
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={active ? 12 : 8}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
      </svg>
      <div className={cx("text-xs uppercase tracking-[0.3em]", active ? "text-cyan-200" : "text-slate-400")}>
        {label}
      </div>
    </div>
  );
}
