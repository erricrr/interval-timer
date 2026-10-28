import { cn, formatClock, getWorkoutDurationReadout, type WorkoutState } from "../lib/utils";

type WorkoutDurationStatProps = {
  state: WorkoutState;
  totalDuration: number;
  remainingSeconds: number;
  align?: "left" | "center";
  compact?: boolean;
  className?: string;
};

export function WorkoutDurationStat({
  state,
  totalDuration,
  remainingSeconds,
  align = "left",
  compact = false,
  className,
}: WorkoutDurationStatProps) {
  const { label, seconds } = getWorkoutDurationReadout(
    state,
    totalDuration,
    remainingSeconds,
  );

  return (
    <div
      className={cn(
        "min-w-0",
        align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      <p
        className={cn(
          "text-[10px] text-text-subtle font-mono uppercase tracking-widest",
          compact && "text-[8px]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-mono text-text-muted tabular-nums",
          compact && "text-sm",
        )}
      >
        {formatClock(seconds)}
      </p>
    </div>
  );
}
