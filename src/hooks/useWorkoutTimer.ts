import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ColorGroup, Interval, WorkoutState } from "../lib/utils";
import { getGroupForInterval } from "../lib/utils";
import { audioEngine } from "../lib/audio";

export type WorkoutSyncRef = {
  intervals: Interval[];
  currentIndex: number;
  colorGroups: ColorGroup[];
  halfwaySoundEnabled: boolean;
};

type Params = {
  state: WorkoutState;
  setState: Dispatch<SetStateAction<WorkoutState>>;
  setCountdownValue: Dispatch<SetStateAction<number>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setTimeLeft: Dispatch<SetStateAction<number>>;
  setTotalTimeElapsed: Dispatch<SetStateAction<number>>;
  workoutSyncRef: MutableRefObject<WorkoutSyncRef>;
};

/**
 * One-second workout clock (no requestAnimationFrame). Reads latest intervals/index from a ref
 * so effects stay subscribed only to `state`, avoiding effect churn during long workouts.
 */
export function useWorkoutTimer({
  state,
  setState,
  setCountdownValue,
  setCurrentIndex,
  setTimeLeft,
  setTotalTimeElapsed,
  workoutSyncRef,
}: Params) {
  // Countdown 3-2-1
  useEffect(() => {
    if (state !== "countdown") return;

    const timer = window.setInterval(() => {
      setCountdownValue((prev) => {
        const next = prev - 1;
        if (next > 0) {
          audioEngine.playCountdown(next);
          return next;
        }

        const { intervals: ivs, colorGroups: cgs } = workoutSyncRef.current;
        if (ivs.length === 0) {
          window.clearInterval(timer);
          return 0;
        }

        window.clearInterval(timer);
        setState("running");
        setCurrentIndex(0);
        setTimeLeft(ivs[0].duration);
        audioEngine.playStart();

        const firstGroup = cgs[0];
        if (firstGroup && firstGroup.mergedPlaylist.length > 0) {
          audioEngine.playPlaylist(
            firstGroup.mergedPlaylist,
            firstGroup.totalDuration,
          );
        }
        return 0;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state, setState, setCountdownValue, setCurrentIndex, setTimeLeft, workoutSyncRef]);

  // Running: one tick per second
  useEffect(() => {
    if (state !== "running") return;

    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        const w = workoutSyncRef.current;
        const currentInterval = w.intervals[w.currentIndex] || w.intervals[0];

        const shouldPlayHalfway =
          currentInterval.halfwayAlert ?? w.halfwaySoundEnabled;
        if (
          shouldPlayHalfway &&
          next === Math.floor(currentInterval.duration / 2)
        ) {
          audioEngine.playMiddle();
        }
        if (next <= 5 && next > 0) {
          audioEngine.playCountdown(next);
        }

        if (next <= 0) {
          if (w.currentIndex < w.intervals.length - 1) {
            audioEngine.playEnd();

            const nextIndex = w.currentIndex + 1;
            const nextInterval = w.intervals[nextIndex];
            const curInterval = w.intervals[w.currentIndex];
            const isSameColor = nextInterval.color === curInterval.color;

            setCurrentIndex(nextIndex);

            if (isSameColor) {
              window.setTimeout(() => {
                audioEngine.playStart();
              }, 500);
            } else {
              audioEngine.stopAll();
              window.setTimeout(() => {
                audioEngine.playStart();
                const nextGroup = getGroupForInterval(
                  w.colorGroups,
                  nextInterval.color,
                );
                if (nextGroup && nextGroup.mergedPlaylist.length > 0) {
                  audioEngine.playPlaylist(
                    nextGroup.mergedPlaylist,
                    nextGroup.totalDuration,
                  );
                }
              }, 500);
            }
            return nextInterval.duration;
          }

          audioEngine.playWorkoutComplete();
          audioEngine.stopAll();
          setState("finished");
          return 0;
        }
        return next;
      });
      setTotalTimeElapsed((p) => p + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [state, setTimeLeft, setTotalTimeElapsed, setCurrentIndex, setState, workoutSyncRef]);
}
