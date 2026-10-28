import { motion } from "motion/react";
import { Play, Edit, Copy, Plus, Timer, MinusCircle } from "lucide-react";
import { Button } from "../components/Button";
import type { SavedWorkout } from "../lib/firebaseSync";
import { getTotalDuration } from "../lib/utils";

interface WorkoutHomeProps {
  savedWorkouts: SavedWorkout[];
  onStartWorkout: (workout: SavedWorkout) => void;
  onEditWorkout: (workout: SavedWorkout) => void;
  onDuplicateWorkout: (id: string) => void;
  onDeleteWorkout: (workout: { id: string; title: string }) => void;
  onCreateWorkout: () => void;
}

export function WorkoutHome({
  savedWorkouts,
  onStartWorkout,
  onEditWorkout,
  onDuplicateWorkout,
  onDeleteWorkout,
  onCreateWorkout,
}: WorkoutHomeProps) {
  if (savedWorkouts.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md"
        >
          <div className="mb-6">
            <Timer size={64} className="mx-auto text-accent/40" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-text">
            No Workouts Yet
          </h2>
          <p className="text-text-muted mb-8 text-sm md:text-base">
            Create your first interval workout to get started. You'll be able to
            customize intervals, add music, and save it for quick access.
          </p>
          <Button
            variant="solid"
            size="lg"
            onClick={onCreateWorkout}
            className="font-bold uppercase tracking-wider"
          >
            <Plus size={20} />
            Create Your First Workout
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="app-scroll pr-2 custom-scrollbar">
        <div className="mb-6">
          <h2 className="text-lg md:text-xl font-bold text-text-muted mb-2">
            Your Workouts
          </h2>
          <p className="text-xs md:text-sm text-text-subtle">
            Tap GO to start, or Edit to customize
          </p>
        </div>

        <div className="space-y-3 pr-2 pb-4">
          {savedWorkouts.map((workout) => {
          const totalSeconds = getTotalDuration(workout.intervals);
          const mins = Math.floor(totalSeconds / 60);
          const secs = totalSeconds % 60;

          // Get up to 5 unique colors from intervals for preview
          const colors = Array.from(
            new Set(workout.intervals.map((i) => i.color))
          ).slice(0, 5);

          return (
            <motion.div
              key={workout.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="glass p-4 md:p-5 rounded-2xl hover:bg-text-subtle/10 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-text mb-2 truncate">
                    {workout.title}
                  </h3>

                  <div className="flex items-center gap-3 mb-3 text-xs text-text-subtle">
                    <span>
                      {workout.intervals.length}{" "}
                      {workout.intervals.length === 1 ? "Interval" : "Intervals"}
                    </span>
                    <span>•</span>
                    <span>
                      {mins}m {secs.toString().padStart(2, "0")}s
                    </span>
                  </div>

                  {/* Color preview */}
                  <div className="flex gap-1.5">
                    {colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="h-1.5 w-8 rounded-full"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}40`,
                        }}
                      />
                    ))}
                    {workout.intervals.length > 5 && (
                      <span className="text-[10px] text-text-subtle/50 ml-1">
                        +{workout.intervals.length - 5}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => onStartWorkout(workout)}
                    className="font-bold uppercase tracking-wider min-w-[80px]"
                  >
                    <Play size={16} fill="currentColor" />
                    GO
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditWorkout(workout)}
                    className="text-text-muted hover:text-accent"
                  >
                    <Edit size={14} />
                    Edit
                  </Button>
                </div>
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-text-subtle/10">
                <button
                  onClick={() => onDuplicateWorkout(workout.id)}
                  className="flex items-center gap-1.5 text-xs text-text-subtle/60 hover:text-accent transition-colors py-1.5 px-2.5 rounded-lg hover:bg-text-subtle/10"
                >
                  <Copy size={12} />
                  Duplicate
                </button>
                <button
                  onClick={() =>
                    onDeleteWorkout({ id: workout.id, title: workout.title })
                  }
                  className="flex items-center gap-1.5 text-xs text-text-subtle/60 hover:text-red-400 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-text-subtle/10"
                >
                  <MinusCircle size={12} />
                  Delete
                </button>
              </div>
            </motion.div>
          );
          })}
        </div>
      </div>

      <div className="shrink-0 flex justify-center pt-4">
        <Button
          variant="solid"
          size="lg"
          onClick={onCreateWorkout}
          className="font-bold uppercase tracking-wider shadow-lg shadow-accent/20"
        >
          <Plus size={20} />
          New Workout
        </Button>
      </div>
    </div>
  );
}
