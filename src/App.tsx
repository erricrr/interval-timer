import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
  useMotionValue,
  useAnimation,
} from "motion/react";
import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  MinusCircle,
  Settings,
  Timer,
  X,
  Music,
  Upload,
  FileText,
  Copy,
  Bookmark,
  SkipForward,
  SkipBack,
  GripVertical,
  MoreVertical,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sun,
  Moon,
  CheckCircle2,
  Loader2,
  Smartphone,
} from "lucide-react";
import { cn, Interval, WorkoutState, COLORS, buildColorGroups, getGroupForInterval, ColorGroup, PlaylistTrack, formatClock, getTotalDuration, getRemainingDuration } from "./lib/utils";
import { audioEngine } from "./lib/audio";
import { useWorkoutTimer, type WorkoutSyncRef } from "./hooks/useWorkoutTimer";
import { useAudioLifecycle } from "./hooks/useAudioLifecycle";
import { useWorkoutAudio } from "./hooks/useWorkoutAudio";
import { useClickOutside } from "./hooks/useClickOutside";
import { useRestoreMobileViewport } from "./hooks/useRestoreMobileViewport";
import { LoginButton } from "./components/LoginButton";
import { Modal, ConfirmModal, LoginModal } from "./components/Modal";
import { Button, CloseButton, type ButtonProps } from "./components/Button";
import { Overlay } from "./components/Overlay";
import { NowPlayingPanel, type SongInfo } from "./components/NowPlayingPanel";
import { WorkoutDurationStat } from "./components/WorkoutDurationStat";
import { useAuth } from "./contexts/AuthContext";
import { WorkoutHome } from "./screens/WorkoutHome";
import {
  saveSettings,
  loadSettings,
  loadWorkout,
  uploadAudioTrack,
  deleteAudioTrack,
  loadAudioLibrary,
  saveWorkoutToLibrary,
  loadSavedWorkouts,
  deleteSavedWorkoutFromLibrary,
  normalizeSavedWorkout,
  normalizeWorkoutData,
} from "./lib/firebaseSync";
import type {
  Settings as FirebaseSettings,
  AudioLibraryEntry,
  SavedWorkout,
} from "./lib/firebaseSync";

const createStarterIntervals = (): Interval[] => [
  { id: crypto.randomUUID(), name: "Warm Up", duration: 10, notes: "", color: COLORS[1] },
  { id: crypto.randomUUID(), name: "Run", duration: 10, notes: "", color: COLORS[3] },
  { id: crypto.randomUUID(), name: "Recovery", duration: 10, notes: "", color: COLORS[2] },
];

const getWorkoutSnapshot = (title: string, intervals: Interval[]) =>
  JSON.stringify({
    title: title.trim() || "New Session",
    intervals: intervals.map((interval) => ({
      id: interval.id,
      name: interval.name || "",
      duration: interval.duration || 0,
      color: interval.color || "#F27D26",
      notes: interval.notes ?? "",
      halfwayAlert: interval.halfwayAlert ?? null,
      playlist: (interval.playlist ?? []).map((track) => ({
        instanceId: track.instanceId,
        audioId: track.audioId,
      })),
    })),
  });

interface SortableIntervalCardProps {
  key?: React.Key;
  interval: Interval;
  colorGroups: ColorGroup[];
  audioLibrary: { id: string; name: string }[];
  globalHalfwayAlert: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updates: Partial<Interval>) => void;
  onOpenPlaylist: () => void;
  onOpenNotes: (id: string) => void;
}

const SortableIntervalCard = ({
  interval,
  colorGroups,
  audioLibrary,
  globalHalfwayAlert,
  onDelete,
  onDuplicate,
  onUpdate,
  onOpenPlaylist,
  onOpenNotes,
}: SortableIntervalCardProps) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={interval}
      dragListener={false}
      dragControls={dragControls}
      className="relative"
    >
      <IntervalCard
        interval={interval}
        colorGroups={colorGroups}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onUpdate={onUpdate}
        onOpenPlaylist={onOpenPlaylist}
        onOpenNotes={onOpenNotes}
        audioLibrary={audioLibrary}
        globalHalfwayAlert={globalHalfwayAlert}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
};

interface IntervalCardProps {
  interval: Interval;
  colorGroups: ColorGroup[];
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updates: Partial<Interval>) => void;
  onOpenPlaylist: () => void;
  onOpenNotes: (id: string) => void;
  audioLibrary: { id: string; name: string }[];
  globalHalfwayAlert: boolean;
  dragControls?: ReturnType<typeof useDragControls>;
}

const IntervalCard = ({
  interval,
  colorGroups,
  onDelete,
  onDuplicate,
  onUpdate,
  onOpenPlaylist,
  onOpenNotes,
  audioLibrary,
  globalHalfwayAlert,
  dragControls,
}: IntervalCardProps) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const x = useMotionValue(0);
  const controls = useAnimation();
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = -80; // Threshold to snap open
  const snapOpenX = -100; // How far the card slides to reveal buttons
  const snapClosedX = 0;

  // Get the merged playlist for this interval's color group (used for playback)
  const colorGroup = useMemo(() =>
    getGroupForInterval(colorGroups, interval.color),
    [colorGroups, interval.color]
  );
  const mergedPlaylist = colorGroup?.mergedPlaylist || [];
  // Use the interval's own playlist count for display, not the merged count
  const trackCount = interval.playlist?.length || 0;

  // Refs for click-outside detection
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useClickOutside(showActions, () => setShowActions(false), [actionsButtonRef, actionsMenuRef]);

  // Close color picker when clicking outside
  useClickOutside(showColorPicker, () => setShowColorPicker(false), [colorButtonRef, colorMenuRef]);

  const mins = Math.floor(interval.duration / 60);
  const secs = interval.duration % 60;

  const isAnyMenuOpen = showColorPicker || showActions;

  // Close swipe when clicking outside
  useEffect(() => {
    if (x.get() < -10) {
      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          controls.start({
            x: snapClosedX,
            transition: { type: "spring", stiffness: 500, damping: 30 },
          });
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [x.get(), controls]);

  // Handle drag end - snap to open or closed
  const handleDragEnd = (
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    const currentX = x.get();
    const velocity = info.velocity.x;

    // If dragged past threshold or with high velocity to the left, snap open
    if (currentX < swipeThreshold || (velocity < -500 && currentX < -20)) {
      controls.start({
        x: snapOpenX,
        transition: { type: "spring", stiffness: 500, damping: 30 },
      });
    } else {
      // Snap closed
      controls.start({
        x: snapClosedX,
        transition: { type: "spring", stiffness: 500, damping: 30 },
      });
    }
  };

  return (
    <div
      className={cn(
        "glass rounded-2xl overflow-hidden relative",
        isAnyMenuOpen && "z-50",
      )}
      style={{ transform: 'translateZ(0)' }}
      data-interval-id={interval.id}
    >
      <div ref={cardRef} className="relative flex flex-row w-full">
        {/* Background Action Buttons - revealed on swipe */}
        <div className="absolute right-0 top-0 bottom-0 w-[110px] flex items-stretch pointer-events-none z-0">
          <button
            onClick={() => {
              onDuplicate();
              controls.start({
                x: snapClosedX,
                transition: { type: "spring", stiffness: 500, damping: 30 },
              });
            }}
            className="w-[55px] bg-text-subtle/10 hover:bg-text-subtle/20 flex flex-col items-center justify-center gap-1 transition-colors border-l border-text-subtle/5 pointer-events-auto"
            aria-label="Duplicate interval"
          >
            <Copy size={20} className="text-text-muted" />
          </button>
          <button
            onClick={() => {
              onDelete();
              controls.start({
                x: snapClosedX,
                transition: { type: "spring", stiffness: 500, damping: 30 },
              });
            }}
            className="w-[55px] bg-red-500/20 hover:bg-red-500/30 flex flex-col items-center justify-center gap-1 transition-colors border-l border-text-subtle/5 pointer-events-auto"
            aria-label="Remove interval"
          >
            <MinusCircle size={20} className="text-red-400" />
          </button>
        </div>

        {/* Swipeable Card Content - using native transform for performance */}
        <motion.div
          drag="x"
          dragConstraints={{ left: -110, right: 0 }}
          dragElastic={0}
          onDragEnd={handleDragEnd}
          animate={controls}
          style={{ x, willChange: 'transform' }}
          className="flex flex-1 flex-row bg-bg relative z-10 group"
        >
          {/* Full Height Drag Handle */}
          <div
            onPointerDown={(e) => dragControls?.start(e)}
            className="w-10 flex items-center justify-center cursor-grab active:cursor-grabbing text-text-subtle hover:text-text-muted hover:bg-text-subtle/10 transition-all border-r border-text-subtle/5 shrink-0 touch-none"
          >
            <GripVertical size={20} />
          </div>

          <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2 relative">
            {/* 3 Dot Menu - Absolute positioned top right */}
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
              <Button
                ref={actionsButtonRef}
                variant="ghost"
                size="icon"
                onClick={() => setShowActions(!showActions)}
                className="w-7 h-7 sm:w-8 sm:h-8 text-text-subtle hover:text-text"
                aria-label="More actions"
              >
                <MoreVertical size={16} />
              </Button>

              <AnimatePresence>
                {showActions && (
                  <motion.div
                    ref={actionsMenuRef}
                    initial={{ opacity: 0, scale: 0.9, x: 5 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 5 }}
                    className="fixed z-[70] glass border border-text-subtle/10 rounded-xl p-1 w-36 overflow-hidden"
                    style={{
                      right: "44px",
                      top: "8px",
                    }}
                  >
                    <button
                      onClick={() => {
                        onDuplicate();
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-muted hover:text-text hover:bg-text-subtle/10 transition-colors text-left"
                    >
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <div className="h-px bg-text-subtle/10 mx-1" />
                    <button
                      onClick={() => {
                        onDelete();
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <MinusCircle size={14} />
                      Remove
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Layout: Two Rows */}
            <div className="sm:hidden flex flex-col gap-2">
              {/* Top Row: Color & Title */}
              <div className="flex items-center gap-2.5 pr-8">
                {/* Color Indicator & Picker */}
                <div className="relative shrink-0">
                  <button
                    ref={colorButtonRef}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-1.5 h-8 rounded-full shrink-0 shadow-lg transition-transform hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: interval.color,
                      boxShadow: `0 0 15px ${interval.color}40`,
                    }}
                    title="Change Color"
                  />

                  <AnimatePresence>
                    {showColorPicker && (
                      <motion.div
                        ref={colorMenuRef}
                        initial={{ opacity: 0, scale: 0.9, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: -10 }}
                        className="absolute left-full ml-3 -top-3 z-40 glass border border-text-subtle/10 rounded-xl p-2 grid grid-cols-5 gap-2 w-[160px]"
                      >
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => {
                              onUpdate({ color });
                              setShowColorPicker(false);
                            }}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                              interval.color === color
                                ? "border-text"
                                : "border-transparent",
                            )}
                            style={{ backgroundColor: color }}
                            aria-label={`Select color ${color}`}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Title Input */}
                <div className="flex-1 min-w-0">
                  <input
                    value={interval.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="Interval Title"
                    className="bg-transparent border-none p-0 font-bold text-base text-text/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg w-full placeholder:text-text-subtle/30 truncate"
                  />
                </div>
              </div>

              {/* Bottom Row: Halfway Alert & Time */}
              <div className="flex items-center gap-3 pl-4">
                {/* Halfway Alert Toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Bell size={12} className="text-text-subtle" aria-hidden="true" />
                  <label
                    htmlFor={`halfway-alert-${interval.id}`}
                    className="text-[10px] font-medium text-text-muted uppercase cursor-pointer"
                  >
                    50%
                  </label>
                  <button
                    id={`halfway-alert-${interval.id}`}
                    role="switch"
                    aria-checked={interval.halfwayAlert ?? globalHalfwayAlert}
                    onClick={() =>
                      onUpdate({
                        halfwayAlert: !(
                          interval.halfwayAlert ?? globalHalfwayAlert
                        ),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onUpdate({
                          halfwayAlert: !(
                            interval.halfwayAlert ?? globalHalfwayAlert
                          ),
                        });
                      }
                    }}
                    className={cn(
                      "w-9 h-5 rounded-full transition-colors relative flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      (interval.halfwayAlert ?? globalHalfwayAlert)
                        ? "bg-accent"
                        : "bg-text-subtle/40",
                    )}
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-full bg-text transition-transform",
                        (interval.halfwayAlert ?? globalHalfwayAlert)
                          ? "translate-x-5"
                          : "translate-x-1",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Time Section */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-0.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={mins === 0 ? "" : mins.toString()}
                      placeholder="0"
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          parseInt(e.target.value.replace(/\D/g, "")) || 0,
                        );
                        onUpdate({ duration: val * 60 + secs });
                      }}
                      className="w-8 bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-right text-xl font-mono font-black text-text tabular-nums selection:bg-accent/30"
                    />
                    <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">
                      m
                    </span>
                  </div>
                  <span className="text-lg font-mono text-text-subtle">
                    :
                  </span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={secs === 0 ? "" : secs.toString()}
                      placeholder="0"
                      onChange={(e) => {
                        let val =
                          parseInt(e.target.value.replace(/\D/g, "")) || 0;
                        if (val > 59) val = 59;
                        if (val < 0) val = 0;
                        onUpdate({ duration: mins * 60 + val });
                      }}
                      className="w-8 bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-right text-xl font-mono font-black text-text tabular-nums selection:bg-accent/30"
                    />
                    <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">
                      s
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Layout: Single Row */}
            <div className="hidden sm:flex items-center gap-3 pr-10">
              {/* Color Indicator & Picker */}
              <div className="relative shrink-0">
                <button
                  ref={colorButtonRef}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-1.5 h-10 rounded-full shrink-0 shadow-lg transition-transform hover:scale-110 active:scale-95"
                  style={{
                    backgroundColor: interval.color,
                    boxShadow: `0 0 15px ${interval.color}40`,
                  }}
                  title="Change Color"
                />

                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div
                      ref={colorMenuRef}
                      initial={{ opacity: 0, scale: 0.9, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: -10 }}
                      className="absolute left-full ml-3 -top-3 z-40 glass border border-text-subtle/10 rounded-xl p-2 grid grid-cols-5 gap-2 w-[160px]"
                    >
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            onUpdate({ color });
                            setShowColorPicker(false);
                          }}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                            interval.color === color
                              ? "border-text"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Title Input */}
              <div className="flex-1 min-w-0">
                <input
                  value={interval.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="Interval Title"
                  className="bg-transparent border-none p-0 font-bold text-base text-text/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg w-full placeholder:text-text-subtle/30 truncate"
                />
              </div>

              {/* Halfway Alert Toggle */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Bell size={12} className="text-text-subtle" aria-hidden="true" />
                <label
                  htmlFor={`halfway-alert-${interval.id}`}
                  className="text-[10px] font-medium text-text-muted uppercase cursor-pointer"
                >
                  50%
                </label>
                <button
                  id={`halfway-alert-${interval.id}`}
                  role="switch"
                  aria-checked={interval.halfwayAlert ?? globalHalfwayAlert}
                  onClick={() =>
                    onUpdate({
                      halfwayAlert: !(
                        interval.halfwayAlert ?? globalHalfwayAlert
                      ),
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onUpdate({
                        halfwayAlert: !(
                          interval.halfwayAlert ?? globalHalfwayAlert
                        ),
                      });
                    }
                  }}
                  className={cn(
                    "w-9 h-5 rounded-full transition-colors relative flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                    (interval.halfwayAlert ?? globalHalfwayAlert)
                      ? "bg-accent"
                      : "bg-text-subtle/40",
                  )}
                >
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full bg-text transition-transform",
                      (interval.halfwayAlert ?? globalHalfwayAlert)
                        ? "translate-x-5"
                        : "translate-x-1",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {/* Time Section */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={mins === 0 ? "" : mins.toString()}
                    placeholder="0"
                    onChange={(e) => {
                      const val = Math.max(
                        0,
                        parseInt(e.target.value.replace(/\D/g, "")) || 0,
                      );
                      onUpdate({ duration: val * 60 + secs });
                    }}
                    className="w-10 bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-right text-2xl font-mono font-black text-text tabular-nums selection:bg-accent/30"
                  />
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">
                    m
                  </span>
                </div>
                <span className="text-xl font-mono text-text-subtle">
                  :
                </span>
                <div className="flex items-center gap-0.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={secs === 0 ? "" : secs.toString()}
                    placeholder="0"
                    onChange={(e) => {
                      let val =
                        parseInt(e.target.value.replace(/\D/g, "")) || 0;
                      if (val > 59) val = 59;
                      if (val < 0) val = 0;
                      onUpdate({ duration: mins * 60 + val });
                    }}
                    className="w-10 bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-right text-2xl font-mono font-black text-text tabular-nums selection:bg-accent/30"
                  />
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">
                    s
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Section: Track Count & Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-text-subtle/10">
              <button
                onClick={onOpenPlaylist}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-text-subtle/5 hover:bg-text-subtle/10 border border-text-subtle/10 hover:border-text-subtle/20 transition-all group"
              >
                <Music
                  size={12}
                  className={cn(
                    "transition-colors",
                    trackCount > 0
                      ? "text-[var(--interval-color)]"
                      : "text-text-subtle group-hover:text-text-muted"
                  )}
                  style={{ color: trackCount > 0 ? interval.color : undefined }}
                />
                <span
                  className={cn(
                    "text-[10px] font-mono font-medium",
                    trackCount > 0 ? "text-text" : "text-text-subtle"
                  )}
                >
                  {trackCount} Tracks
                </span>
                <Plus
                  size={10}
                  className="text-text-subtle group-hover:text-text-muted transition-colors"
                />
              </button>

              <div className="flex-1" />

              <Button
                variant={interval.notes ? "accent" : "ghost"}
                size="xs"
                onClick={() => onOpenNotes(interval.id)}
                title={interval.notes ? "View/Edit Notes" : "Add Notes"}
                className="h-5 px-2 text-[9px]"
              >
                <FileText size={10} />
                Notes
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

interface PlaylistDrawerProps {
  isOpen: boolean;
  interval: Interval | null;
  audioLibrary: { id: string; name: string }[];
  onClose: () => void;
  onUpdatePlaylist: (updater: (currentPlaylist: PlaylistTrack[]) => PlaylistTrack[]) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAudio: (id: string) => void;
  isUploading?: boolean;
}

const PlaylistDrawer = ({
  isOpen,
  interval,
  audioLibrary,
  onClose,
  onUpdatePlaylist,
  onFileUpload,
  onRemoveAudio,
  isUploading = false,
}: PlaylistDrawerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioToDelete, setAudioToDelete] = useState<{ id: string; name: string } | null>(null);
  const intervalColor = interval?.color || "#F27D26";
  const intervalName = interval?.name || "Untitled";

  // Use only this interval's playlist, not the merged playlist from all intervals with same color
  const currentPlaylist = interval?.playlist || [];

  const formatAudioName = (name: string) => {
    // Remove file extension
    return name.replace(/\.[^/.]+$/, "");
  };

  const titleContent = (
    <div>
      <h2 className="text-xl font-black uppercase tracking-widest text-text">
        Edit Tracks
      </h2>
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mt-1">
        Interval:{" "}
        <span style={{ color: intervalColor }}>
          {intervalName}
        </span>
      </p>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        variant="bottom-sheet"
        title={titleContent}
        contentClassName="p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar"
        style={{ "--interval-color": intervalColor } as React.CSSProperties}
      >
        {/* Current Playlist */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
              Current Tracks
            </h3>
            <span className="text-[10px] font-mono text-text-subtle">
              {currentPlaylist.length} Total
            </span>
          </div>

          <Reorder.Group
            axis="y"
            values={currentPlaylist}
            onReorder={(newPlaylist) => onUpdatePlaylist(() => newPlaylist)}
            className="space-y-2"
          >
            {currentPlaylist.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-text-subtle/10 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                <Music size={24} className="text-text-subtle/30" />
                <p className="text-xs text-text-subtle/50 italic">
                  No songs in playlist
                </p>
              </div>
            ) : (
              currentPlaylist.map((track, trackIndex) => {
                const audio = audioLibrary.find(
                  (a) => a.id === track.audioId,
                );
                return (
                  <Reorder.Item
                    key={track.instanceId || `${track.audioId}-${trackIndex}`}
                    value={track}
                    className="glass p-3 rounded-xl flex items-center gap-3 group/item border border-text-subtle/10 hover:border-text-subtle/20 transition-colors"
                  >
                    <div className="text-text-subtle group-hover/item:text-text-muted transition-colors cursor-grab active:cursor-grabbing">
                      <GripVertical size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-text/80 truncate">
                        {formatAudioName(audio?.name || "Missing audio track")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onUpdatePlaylist((current) =>
                          current.filter((t) => t.instanceId !== track.instanceId)
                        );
                      }}
                      className="p-1.5 text-text-subtle hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      aria-label="Remove track"
                    >
                      <MinusCircle size={14} />
                    </button>
                  </Reorder.Item>
                );
              })
            )}
          </Reorder.Group>
        </section>

        {/* Add from Library */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
              Library
            </h3>
            <Button
              variant="upload"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 text-xs font-bold uppercase tracking-wider"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full"
                  />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload New
                </>
              )}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileUpload}
              multiple
              accept=".mp3,.wav,.ogg,.oga,.ogv,audio/mpeg,audio/wav,audio/x-wav,audio/ogg"
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {audioLibrary.length === 0 ? (
              <p className="text-[10px] text-text-subtle/50 italic text-center py-4">
                No songs in library
              </p>
            ) : (
              audioLibrary.map((audio) => (
                <div key={audio.id} className="flex items-center gap-1">
                  {/* Main clickable area - adds to playlist */}
                  <button
                    onClick={() =>
                      onUpdatePlaylist((current) => [
                        ...current,
                        {
                          instanceId: Math.random()
                            .toString(36)
                            .substr(2, 9),
                          audioId: audio.id,
                        },
                      ])
                    }
                    className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-text-subtle/5 hover:bg-text-subtle/10 border border-transparent hover:border-text-subtle/10 transition-all text-left overflow-hidden min-w-0"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 text-accent shrink-0">
                      <Music size={14} />
                    </div>
                    <span className="flex-1 text-xs text-text-muted truncate min-w-0">
                      {formatAudioName(audio.name)}
                    </span>
                    <div className="w-8 h-8 flex items-center justify-center text-text-subtle hover:text-[var(--interval-color)] transition-colors shrink-0">
                      <Plus size={16} />
                    </div>
                  </button>
                  {/* Separate delete button */}
                  <button
                    onClick={() => setAudioToDelete({ id: audio.id, name: audio.name })}
                    className="p-3 rounded-xl text-text-subtle hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Remove from library"
                  >
                    <MinusCircle size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </Modal>

      {/* Delete Audio Confirmation */}
      <AnimatePresence>
        {audioToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setAudioToDelete(null)}
            className="fixed inset-0 z-[150] bg-bg/60 backdrop-blur-sm cursor-pointer"
          />
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={audioToDelete !== null}
        onClose={() => setAudioToDelete(null)}
        title="Delete Audio Track?"
        message={`Are you sure you want to delete "${audioToDelete ? formatAudioName(audioToDelete.name) : ''}"? This will also remove it from any intervals using this track.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (audioToDelete) {
            onRemoveAudio(audioToDelete.id);
          }
        }}
        confirmVariant="danger"
        showOverlay={false}
        className="z-[200]"
      />
    </>
  );
};

const EDITOR_HEADER_ACTION_CLASS =
  "h-7 px-3 text-[10px] font-bold uppercase tracking-wider glass";

const EditorHeaderAction = ({
  className,
  variant = "secondary",
  ...props
}: ButtonProps) => (
  <Button
    {...props}
    variant={variant}
    size="xs"
    className={cn(EDITOR_HEADER_ACTION_CLASS, className)}
  />
);

export default function App() {
  useRestoreMobileViewport();

  const [view, setView] = useState<"home" | "editor">("home");
  const [workoutTitle, setWorkoutTitle] = useState("New Session");
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(null);
  const [intervals, setIntervals] = useState<Interval[]>(() => createStarterIntervals());

  const [state, setState] = useState<WorkoutState>("idle");
  const [countdownValue, setCountdownValue] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentSong, setCurrentSong] = useState<SongInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [audioLibrary, setAudioLibrary] = useState<
    { id: string; name: string }[]
  >([]);
  const [editingIntervalId, setEditingIntervalId] = useState<string | null>(
    null,
  );
  const [viewingNotesId, setViewingNotesId] = useState<string | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<{ id: string; title: string } | null>(null);
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { user, isAuthLoading } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioStoragePaths, setAudioStoragePaths] = useState<Record<string, string>>({});
  const hasLoadedInitialData = useRef(false);
  const hasAutoLoadedWorkout = useRef(false);
  const skipSettingsAutoSave = useRef(false);
  const lastSavedSnapshotRef = useRef<string | null>(null);

  // Alarm settings state
  const [alarmVolume, setAlarmVolume] = useState(0.5);
  const [alarmPreset, setAlarmPreset] = useState<
    "digital" | "chime" | "bell" | "buzzer" | "custom"
  >("digital");
  const [customAlarmName, setCustomAlarmName] = useState("");
  const [halfwaySoundEnabled, setHalfwaySoundEnabled] = useState(false);
  const [musicMuted, setMusicMuted] = useState(() => {
    const saved = localStorage.getItem("tempotread_music_muted");
    return saved === "true";
  });
  const alarmFileInputRef = useRef<HTMLInputElement>(null);

  // Save confirmation states
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [timelineSaved, setTimelineSaved] = useState(false);
  const [notesAutosaved, setNotesAutosaved] = useState(false);
  const notesAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme state - initialize from system preference or localStorage
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // First check localStorage
    const saved = localStorage.getItem("tempotread_theme");
    if (saved === "light" || saved === "dark") return saved;
    // Then check system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  });

  // Apply data-theme attribute immediately and on change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tempotread_theme", theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      const saved = localStorage.getItem("tempotread_theme");
      if (!saved) {
        setTheme(e.matches ? "light" : "dark");
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [isMobileLandscape, setIsMobileLandscape] = useState(
    () => window.innerWidth > window.innerHeight && window.innerHeight <= 500,
  );
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsMobileLandscape(
        window.innerWidth > window.innerHeight && window.innerHeight <= 500,
      );
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll when notes popup is open on mobile to prevent viewport shift
  useEffect(() => {
    if (viewingNotesId && isMobile) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [viewingNotesId, isMobile]);

  useEffect(() => {
    if (viewingNotesId) return;

    setNotesAutosaved(false);
    if (notesAutosaveTimeoutRef.current) {
      clearTimeout(notesAutosaveTimeoutRef.current);
      notesAutosaveTimeoutRef.current = null;
    }
  }, [viewingNotesId]);

  // Compute color groups from intervals
  const colorGroups = useMemo(() => buildColorGroups(intervals, audioLibrary), [intervals, audioLibrary]);

  const workoutSyncRef = useRef<WorkoutSyncRef>({
    intervals,
    currentIndex,
    colorGroups,
    halfwaySoundEnabled,
  });
  workoutSyncRef.current = {
    intervals,
    currentIndex,
    colorGroups,
    halfwaySoundEnabled,
  };

  useAudioLifecycle();
  const { syncPlaylistOnIntervalChange, resumeGroupPlaylist } = useWorkoutAudio();
  useWorkoutTimer({
    state,
    setState,
    setCountdownValue,
    setCurrentIndex,
    setTimeLeft,
    workoutSyncRef,
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const countdownTimelineRef = useRef<HTMLDivElement>(null);
  const intervalRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load cloud data when user signs in
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      setIsDataLoading(false);
      setIsAudioLoading(false);
      hasLoadedInitialData.current = false;
      audioEngine.clearLibrary();
      setAudioLibrary([]);
      setAudioStoragePaths({});
      // Reset workout state on logout to prevent previous user data showing
      setWorkoutTitle("New Session");
      setIntervals(createStarterIntervals());
      setCurrentWorkoutId(null);
      setSavedWorkouts([]);
      lastSavedSnapshotRef.current = null;
      setShowUnsavedChanges(false);
      return;
    }

    let cancelled = false;

    const loadUserData = async () => {
      setIsDataLoading(true);
      setIsAudioLoading(true);
      hasLoadedInitialData.current = false;
      audioEngine.clearLibrary();

      let audioEntries: AudioLibraryEntry[] = [];

      try {
        const [workoutData, settings, workouts, loadedAudio] = await Promise.all([
          loadWorkout(user.uid),
          loadSettings(user.uid),
          loadSavedWorkouts(user.uid).catch((err) => {
            console.error("Failed to load saved workouts:", err);
            return [];
          }),
          loadAudioLibrary(user.uid).catch((err) => {
            console.error("Failed to load audio library:", err);
            return [];
          }),
        ]);

        if (cancelled) return;

        audioEntries = loadedAudio;

        // Don't auto-load any workout - let the home screen handle workout selection
        // Just load the library for display

        if (settings) {
          skipSettingsAutoSave.current = true;
          setAlarmVolume(settings.alarmVolume);
          setAlarmPreset(settings.alarmPreset);
          setCustomAlarmName(settings.customAlarmName);
          setHalfwaySoundEnabled(settings.halfwaySoundEnabled);
          setMusicMuted(settings.musicMuted ?? false);
          audioEngine.setMusicMuted(settings.musicMuted ?? false);
        }

        // Sort workouts by updatedAt (newest first), then by title
        const sortedWorkouts = workouts.map(normalizeSavedWorkout).sort((a, b) => {
          if (a.updatedAt && b.updatedAt) {
            return b.updatedAt - a.updatedAt;
          }
          if (a.updatedAt) return -1;
          if (b.updatedAt) return 1;
          return a.title.localeCompare(b.title);
        });
        setSavedWorkouts(sortedWorkouts);
        hasLoadedInitialData.current = true;
      } catch (err) {
        console.error("Firestore failed (loadUserData):", err);
      } finally {
        if (!cancelled) {
          setIsDataLoading(false);
        }
      }

      if (cancelled || audioEntries.length === 0) {
        if (!cancelled) {
          setAudioLibrary([]);
          setAudioStoragePaths({});
          setIsAudioLoading(false);
        }
        return;
      }

      try {
        const paths: Record<string, string> = {};
        const libraryForUI: { id: string; name: string }[] = [];

        await Promise.all(
          audioEntries.map(async (entry) => {
            try {
              await audioEngine.addAudioFromURL(
                entry.id,
                entry.name,
                entry.downloadURL,
                entry.duration,
              );
              paths[entry.id] = entry.storagePath;
              libraryForUI.push({ id: entry.id, name: entry.name });
            } catch (audioErr) {
              console.error(`Failed to load audio ${entry.name}:`, audioErr);
            }
          }),
        );

        if (!cancelled) {
          setAudioStoragePaths(paths);
          setAudioLibrary(libraryForUI);
        }
      } catch (err) {
        console.error("Firestore failed (loadAudio):", err);
      } finally {
        if (!cancelled) {
          setIsAudioLoading(false);
        }
      }
    };

    void loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (user || isAuthLoading) return;

    const saved = localStorage.getItem("tempotread_workouts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const normalized = Array.isArray(parsed)
          ? parsed.map((workout) => normalizeSavedWorkout(workout))
          : [];
        // Sort by updatedAt (newest first), then by title
        const sorted = normalized.sort((a, b) => {
          if (a.updatedAt && b.updatedAt) {
            return b.updatedAt - a.updatedAt;
          }
          if (a.updatedAt) return -1;
          if (b.updatedAt) return 1;
          return a.title.localeCompare(b.title);
        });
        setSavedWorkouts(sorted);
      } catch (e) {
        console.error("Failed to load saved workouts from localStorage");
      }
    }

    // Load alarm settings
    const savedAlarmSettings = localStorage.getItem(
      "tempotread_alarm_settings",
    );
    if (savedAlarmSettings) {
      try {
        const settings = JSON.parse(savedAlarmSettings);
        if (settings.volume !== undefined) {
          setAlarmVolume(settings.volume);
          audioEngine.setAlarmVolume(settings.volume);
        }
        if (settings.preset !== undefined) {
          setAlarmPreset(settings.preset);
          audioEngine.setAlarmPreset(settings.preset);
        }
        if (settings.halfwaySoundEnabled !== undefined) {
          setHalfwaySoundEnabled(settings.halfwaySoundEnabled);
        }
        if (settings.musicMuted !== undefined) {
          setMusicMuted(settings.musicMuted);
          audioEngine.setMusicMuted(settings.musicMuted);
        }
      } catch (e) {
        console.error("Failed to load alarm settings from localStorage");
      }
    }
  }, [user, isAuthLoading]);

  // Removed auto-load effect - home screen will handle workout selection

  useEffect(() => {
    // Only persist to localStorage when user is not logged in AND auth has finished loading
    // This prevents wiping localStorage before guest data is loaded
    if (!user && !isAuthLoading) {
      localStorage.setItem("tempotread_workouts", JSON.stringify(savedWorkouts));
    }
  }, [savedWorkouts, user, isAuthLoading]);

  // Save alarm settings when they change
  useEffect(() => {
    const settings = {
      volume: alarmVolume,
      preset: alarmPreset,
      customAlarmName: customAlarmName,
      halfwaySoundEnabled: halfwaySoundEnabled,
      musicMuted: musicMuted,
    };
    localStorage.setItem("tempotread_alarm_settings", JSON.stringify(settings));
    localStorage.setItem("tempotread_music_muted", musicMuted.toString());
    audioEngine.setAlarmVolume(alarmVolume);
    audioEngine.setAlarmPreset(alarmPreset);
    audioEngine.setMusicMuted(musicMuted);
  }, [alarmVolume, alarmPreset, customAlarmName, halfwaySoundEnabled, musicMuted]);

  // Auto-save alarm settings to Firebase for logged-in users (debounced)
  useEffect(() => {
    if (!user || !hasLoadedInitialData.current) return;
    if (skipSettingsAutoSave.current) {
      skipSettingsAutoSave.current = false;
      return;
    }

    setIsSavingSettings(true);
    const timeoutId = setTimeout(async () => {
      try {
        await saveSettings(user.uid, {
          alarmVolume,
          alarmPreset,
          customAlarmName,
          customAlarmStoragePath: null,
          halfwaySoundEnabled,
          musicMuted,
        });
      } catch (err) {
        console.error("Failed to auto-save settings to Firebase:", err);
      } finally {
        setIsSavingSettings(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [user, alarmVolume, alarmPreset, customAlarmName, halfwaySoundEnabled, musicMuted]);

  // Removed saveCurrentWorkout - no longer needed with new save flow

  const loadSavedWorkout = (
    workout: SavedWorkout,
    mode: "edit" | "start" = "edit"
  ) => {
    const normalizedWorkout = normalizeSavedWorkout(workout);
    setWorkoutTitle(normalizedWorkout.title);
    setIntervals(normalizedWorkout.intervals);
    setCurrentWorkoutId(normalizedWorkout.id);
    lastSavedSnapshotRef.current = getWorkoutSnapshot(
      normalizedWorkout.title,
      normalizedWorkout.intervals,
    );
    setShowUnsavedChanges(false);
    setShowSettings(false);

    if (mode === "start") {
      // Start the workout immediately
      startWorkout();
    } else {
      // Go to editor
      setView("editor");
    }
  };

  const deleteSavedWorkout = async (id: string) => {
    // If logged in, delete from Firestore first
    if (user) {
      try {
        await deleteSavedWorkoutFromLibrary(user.uid, id);
      } catch (err) {
        console.error("Failed to delete workout from Firestore:", err);
        // Still update local state even if Firestore fails
      }
    }

    setSavedWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  const duplicateSavedWorkout = async (id: string) => {
    const workoutToDuplicate = savedWorkouts.find((w) => w.id === id);
    if (!workoutToDuplicate) return;

    const newId = crypto.randomUUID();
    const duplicatedWorkout = {
      id: newId,
      title: `Copy of ${workoutToDuplicate.title}`,
      intervals: workoutToDuplicate.intervals.map((interval) => ({
        ...interval,
        id: crypto.randomUUID(),
      })),
      updatedAt: Date.now(),
    };

    // If logged in, save to Firestore first
    if (user) {
      try {
        await saveWorkoutToLibrary(user.uid, duplicatedWorkout);
      } catch (err) {
        console.error("Failed to save duplicated workout to Firestore:", err);
        // Still update local state even if Firestore fails
      }
    }

    setSavedWorkouts((prev) => {
      const updated = [duplicatedWorkout, ...prev];
      // Re-sort by updatedAt
      return updated.sort((a, b) => {
        if (a.updatedAt && b.updatedAt) {
          return b.updatedAt - a.updatedAt;
        }
        if (a.updatedAt) return -1;
        if (b.updatedAt) return 1;
        return a.title.localeCompare(b.title);
      });
    });
  };

  const clearWorkout = () => {
    setWorkoutTitle("New Session");
    setIntervals(createStarterIntervals());
    setCurrentWorkoutId(null);
    lastSavedSnapshotRef.current = null;
    setShowUnsavedChanges(false);
    resetWorkout();
    setView("editor");
  };

  const hasUnsavedChanges = () =>
    lastSavedSnapshotRef.current === null ||
    lastSavedSnapshotRef.current !== getWorkoutSnapshot(workoutTitle, intervals);

  const handleBackToWorkouts = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedChanges(true);
      return;
    }
    setView("home");
  };

  const leaveWithoutSaving = () => {
    setShowUnsavedChanges(false);
    setView("home");
  };

  const duplicateInterval = (index: number) => {
    const intervalToCopy = intervals[index];
    const newInterval: Interval = {
      ...intervalToCopy,
      id: Math.random().toString(36).substr(2, 9),
    };
    const newIntervals = [...intervals];
    newIntervals.splice(index + 1, 0, newInterval);
    setIntervals(newIntervals);
  };

  // --- Logic ---

  const currentInterval = intervals[currentIndex] || intervals[0];
  const themeColor = useMemo(() => {
    if (state === "finished") return "#888888";
    return currentInterval?.color || "#F27D26";
  }, [state, currentInterval]);
  const hasCurrentInterval = Boolean(currentInterval);
  const totalDuration = useMemo(() => getTotalDuration(intervals), [intervals]);
  const remainingTotalDuration = getRemainingDuration(
    intervals,
    currentIndex,
    timeLeft,
  );
  const safeTimeLeft = Math.max(0, timeLeft);
  const currentIntervalDuration = currentInterval?.duration ?? 0;
  const currentIntervalNotes = currentInterval?.notes ?? "";
  const currentIntervalId = currentInterval?.id ?? null;
  const currentHalfwayAlertEnabled =
    currentInterval?.halfwayAlert ?? halfwaySoundEnabled;
  const currentIntervalProgress =
    currentIntervalDuration > 0 ? safeTimeLeft / currentIntervalDuration : 0;
  const clampedIntervalProgress = Math.min(
    1,
    Math.max(0, currentIntervalProgress),
  );
  const isWorkoutOverlayVisible =
    state === "countdown" ||
    state === "running" ||
    state === "paused" ||
    state === "finished";
  const isCountdownState = state === "countdown";
  const showWorkoutTopControls =
    hasCurrentInterval &&
    !isCountdownState &&
    state !== "finished" &&
    (Boolean(currentIntervalNotes) || state === "running" || state === "paused");

  const startWorkout = () => {
    if (intervals.length === 0) return;
    void audioEngine.resumeAudioContext();

    if (state === "idle" || state === "finished") {
      // Synchronous tap path: primes HTMLAudio for iOS (delayed play after countdown)
      audioEngine.primePlaybackFromUserGesture();
      if (state === "finished") {
        resetWorkout();
      }
      setState("countdown");
      setCountdownValue(3);
      audioEngine.playCountdown(3);
    } else if (state === "paused") {
      setState("running");
      resumeGroupPlaylist(colorGroups, intervals[currentIndex]?.color ?? "");
    }
  };

  const pauseWorkout = () => {
    setState("paused");
    audioEngine.pauseAll();
  };

  const resetWorkout = () => {
    setState("idle");
    setCurrentIndex(0);
    setTimeLeft(0);
    setCountdownValue(0);
    audioEngine.stopAll();
    // Return to home after finishing/closing workout
    setView("home");
  };

  const handleSaveWorkout = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      const titleToSave = workoutTitle?.trim() || "New Session";
      const now = Date.now();

      if (currentWorkoutId) {
        // Update existing workout
        const workoutToUpdate = {
          id: currentWorkoutId,
          title: titleToSave,
          intervals: intervals.map(interval => ({
            id: interval.id,
            name: interval.name || "",
            duration: interval.duration || 0,
            color: interval.color || "#F27D26",
            ...(interval.notes !== undefined && { notes: interval.notes }),
            ...(interval.playlist !== undefined ? { playlist: interval.playlist } : { playlist: [] }),
            ...(interval.halfwayAlert !== undefined && { halfwayAlert: interval.halfwayAlert }),
          })),
          updatedAt: now,
        };
        await saveWorkoutToLibrary(user.uid, workoutToUpdate);

        setSavedWorkouts(prev => {
          const filtered = prev.filter(w => w.id !== currentWorkoutId);
          const updated = [workoutToUpdate, ...filtered];
          // Re-sort by updatedAt
          return updated.sort((a, b) => {
            if (a.updatedAt && b.updatedAt) {
              return b.updatedAt - a.updatedAt;
            }
            if (a.updatedAt) return -1;
            if (b.updatedAt) return 1;
            return a.title.localeCompare(b.title);
          });
        });
      } else {
        // Create new workout
        const newId = crypto.randomUUID();
        const newWorkout = {
          id: newId,
          title: titleToSave,
          intervals: intervals.map(interval => ({
            id: interval.id,
            name: interval.name || "",
            duration: interval.duration || 0,
            color: interval.color || "#F27D26",
            ...(interval.notes !== undefined && { notes: interval.notes }),
            ...(interval.playlist !== undefined ? { playlist: interval.playlist } : { playlist: [] }),
            ...(interval.halfwayAlert !== undefined && { halfwayAlert: interval.halfwayAlert }),
          })),
          updatedAt: now,
        };
        await saveWorkoutToLibrary(user.uid, newWorkout);

        setSavedWorkouts(prev => {
          const updated = [newWorkout, ...prev];
          // Re-sort by updatedAt
          return updated.sort((a, b) => {
            if (a.updatedAt && b.updatedAt) {
              return b.updatedAt - a.updatedAt;
            }
            if (a.updatedAt) return -1;
            if (b.updatedAt) return 1;
            return a.title.localeCompare(b.title);
          });
        });
        setCurrentWorkoutId(newId);
      }

      lastSavedSnapshotRef.current = getWorkoutSnapshot(titleToSave, intervals);
      setShowUnsavedChanges(false);
      setTimelineSaved(true);
      setTimeout(() => setTimelineSaved(false), 2000);

      // Return to home after saving
      setTimeout(() => setView("home"), 1000);
    } catch (err) {
      console.error("Timeline SAVE failed:", err);
      alert("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const refreshCurrentSong = () => {
    setCurrentSong(audioEngine.getCurrentSongInfo());
  };

  const jumpInterval = (step: number) => {
    const targetIndex = currentIndex + step;
    if (targetIndex < 0) return;

    if (targetIndex >= intervals.length) {
      audioEngine.playWorkoutComplete();
      audioEngine.stopAll();
      setState("finished");
      return;
    }

    const fromColor = intervals[currentIndex].color;
    const toInterval = intervals[targetIndex];
    const isPaused = state === "paused";

    setCurrentIndex(targetIndex);
    setTimeLeft(toInterval.duration);

    if (state === "running") {
      audioEngine.playStart();
    }

    syncPlaylistOnIntervalChange(colorGroups, fromColor, toInterval.color, {
      startPaused: isPaused,
    });
    refreshCurrentSong();
  };

  const previousInterval = () => jumpInterval(-1);
  const nextInterval = () => jumpInterval(1);

  const skipTrack = (direction: "previous" | "next") => {
    const didSkip =
      direction === "previous"
        ? audioEngine.skipToPreviousTrack()
        : audioEngine.skipToNextTrack();
    if (didSkip) {
      refreshCurrentSong();
    }
  };

  const toggleCurrentIntervalHalfwayAlert = () => {
    if (!currentInterval) return;
    const effectiveEnabled =
      currentInterval.halfwayAlert ?? halfwaySoundEnabled;
    const nextEnabled = !effectiveEnabled;

    setIntervals((prev) =>
      prev.map((interval, index) =>
        index === currentIndex
          ? { ...interval, halfwayAlert: nextEnabled }
          : interval,
      ),
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      const supportedExtensions = [".mp3", ".wav", ".ogg", ".oga", ".ogv"];
      const unsupportedFiles: string[] = [];
      const supportedFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name
          .toLowerCase()
          .substring(file.name.lastIndexOf("."));
        if (supportedExtensions.includes(ext)) {
          supportedFiles.push(file);
        } else {
          unsupportedFiles.push(file.name);
        }
      }

      if (unsupportedFiles.length > 0) {
        alert(
          `The following file types are not supported:\n${unsupportedFiles.join("\n")}\n\nPlease use MP3, WAV, or OGG files only.`,
        );
      }

      try {
        for (const file of supportedFiles) {
          const id = crypto.randomUUID();
          const duration = await audioEngine.probeFileDuration(file);

          if (user) {
            try {
              const entry = await uploadAudioTrack(user.uid, file, id, duration);
              try {
                await audioEngine.addAudioFromURL(
                  entry.id,
                  entry.name,
                  entry.downloadURL,
                  entry.duration ?? duration,
                );
              } catch (loadErr) {
                console.error("Failed to load Firebase audio URL:", loadErr);
                const blobUrl = URL.createObjectURL(file);
                await audioEngine.addAudioFromURL(
                  entry.id,
                  entry.name,
                  blobUrl,
                  duration,
                  { revokeOnRemove: true },
                );
                alert(
                  "Audio uploaded to cloud but couldn't load from remote URL. Using local playback.",
                );
              }
              setAudioStoragePaths((prev) => ({
                ...prev,
                [entry.id]: entry.storagePath,
              }));
              setAudioLibrary((prev) => [
                ...prev.filter((item) => item.id !== entry.id),
                { id: entry.id, name: entry.name },
              ]);
            } catch (err) {
              console.error("Failed to upload Firebase audio:", err);
              alert("Failed to upload audio to cloud. Saving locally instead.");
              const localId = await audioEngine.addCustomAudio(file);
              setAudioLibrary((prev) => [
                ...prev.filter((item) => item.id !== localId),
                { id: localId, name: file.name },
              ]);
            }
          } else {
            const localId = await audioEngine.addCustomAudio(file);
            setAudioLibrary((prev) => [
              ...prev.filter((item) => item.id !== localId),
              { id: localId, name: file.name },
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to load audio:", err);
        alert(
          "Failed to load audio file(s). Please ensure they are valid MP3, WAV, or OGG files.",
        );
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeAudio = async (id: string) => {
    if (user && audioStoragePaths[id]) {
      try {
        await deleteAudioTrack(user.uid, id, audioStoragePaths[id]);
        setAudioStoragePaths((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
      } catch (err) {
        console.error("Failed to delete audio from cloud:", err);
        alert("Failed to delete track from cloud. Please try again.");
        return;
      }
    }

    audioEngine.removeAudio(id);
    setAudioLibrary((prev) => prev.filter((item) => item.id !== id));
    setIntervals((prev) =>
      prev.map((interval) => ({
        ...interval,
        playlist: interval.playlist?.filter((track) => track.audioId !== id),
      })),
    );
  };

  useEffect(() => {
    let songPolling: number;
    if (state === "running" || state === "countdown" || state === "paused") {
      songPolling = window.setInterval(() => {
        setCurrentSong(audioEngine.getCurrentSongInfo());
      }, 1000);
    } else {
      setCurrentSong(null);
    }
    return () => clearInterval(songPolling);
  }, [state]);

  // Auto-scroll countdown timeline to active interval
  useEffect(() => {
    if ((state === "running" || state === "paused") && intervalRefs.current[currentIndex]) {
      intervalRefs.current[currentIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex, state]);

  const addInterval = () => {
    setIntervals((prev) => {
      const newInterval: Interval = {
        id: Math.random().toString(36).substr(2, 9),
        name: "New Interval",
        duration: 60,
        notes: "",
        color: COLORS[prev.length % COLORS.length],
        halfwayAlert: undefined,
      };
      return [...prev, newInterval];
    });
  };

  const scrollTimeline = (direction: "left" | "right") => {
    if (timelineRef.current) {
      const scrollAmount = 200;
      timelineRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const updatePlaylistForColorGroup = (
    intervalColor: string,
    playlist: PlaylistTrack[],
  ) => {
    setIntervals((prev) =>
      prev.map((interval) =>
        interval.color === intervalColor ? { ...interval, playlist } : interval,
      ),
    );
  };

  const deleteInterval = (id: string) => {
    setIntervals((prev) => prev.filter((interval) => interval.id !== id));
  };

  const updateInterval = (id: string, updates: Partial<Interval>) => {
    setIntervals((prev) =>
      prev.map((interval) =>
        interval.id === id ? { ...interval, ...updates } : interval,
      ),
    );
  };

  // --- Render ---

  const isLoading = isAuthLoading || (user && isDataLoading);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full bg-bg text-text font-sans antialiased flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-3 border-text-subtle/20 border-t-accent rounded-full"
              style={{ borderWidth: "3px" }}
            />
            <p className="text-xs font-mono text-text-subtle uppercase tracking-widest">
              Loading...
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="h-full bg-bg text-text font-sans antialiased selection:bg-accent/30 overflow-hidden"
        >
          <div className="max-w-7xl mx-auto flex flex-col p-4 md:px-8 md:pb-8 lg:px-12 lg:pb-12 h-full min-h-0">
        <header className="flex flex-col gap-4 mb-4 shrink-0">
          {/* Top Row: App Title + Actions */}
          <div className="flex items-center justify-between">
            {/* App Title */}
            <div className="flex items-center gap-2 text-accent">
              <Timer size={24} />
              <span className="text-lg font-black tracking-tight uppercase">
                Interval Timer
              </span>
            </div>

            {/* Login & Settings */}
            <div className="flex items-center gap-2">
              {isAudioLoading && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-text-subtle">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="hidden sm:inline">Loading tracks</span>
                  <span className="sm:hidden">Tracks...</span>
                </span>
              )}
              <LoginButton />
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 sm:p-3 glass rounded-full text-text-muted hover:text-text hover:bg-text-subtle/10 transition-all hover:scale-110 active:scale-95"
                title="Settings"
              >
                <Settings size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </header>

        {view === "home" ? (
          <WorkoutHome
            savedWorkouts={savedWorkouts}
            onStartWorkout={(workout) => loadSavedWorkout(workout, "start")}
            onEditWorkout={(workout) => loadSavedWorkout(workout, "edit")}
            onDuplicateWorkout={duplicateSavedWorkout}
            onDeleteWorkout={(workout) => setWorkoutToDelete(workout)}
            onCreateWorkout={clearWorkout}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Workout Title & Duration - pinned above the list scroller */}
        <div className="shrink-0 z-30 bg-bg/95 backdrop-blur-md py-2 border-b border-text-subtle/10 -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleBackToWorkouts}
                className="flex items-center gap-1 shrink-0 text-text-muted hover:text-accent transition-colors text-sm whitespace-nowrap"
              >
                <ChevronLeft size={16} />
                Back to Workouts
              </button>
              <input
                value={workoutTitle}
                onChange={(e) => setWorkoutTitle(e.target.value)}
                className="min-w-0 flex-1 text-right text-lg md:text-xl lg:text-2xl font-black tracking-tighter text-accent bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg uppercase truncate"
                aria-label="Workout title"
              />
            </div>
            <div className="grid grid-cols-3 items-end mt-1">
              <WorkoutDurationStat
                state={state}
                totalDuration={totalDuration}
                remainingSeconds={remainingTotalDuration}
              />

              <div className="flex justify-center">
                <EditorHeaderAction onClick={addInterval}>
                  <Plus size={12} />
                  Interval
                </EditorHeaderAction>
              </div>

              <div className="flex justify-end">
                <EditorHeaderAction
                  variant="accent"
                  onClick={handleSaveWorkout}
                >
                  <Bookmark size={12} />
                  {timelineSaved ? "Saved!" : "Save"}
                </EditorHeaderAction>
              </div>
            </div>
          </div>

        <main className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Timeline Section */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Workout Timeline Guide - pinned above the interval list */}
            <div className="shrink-0 z-20 bg-bg py-2 -mx-4 px-4 border-b border-text-subtle/10">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollTimeline("left")}
                  className="w-7 h-7 rounded-full flex-shrink-0"
                  aria-label="Scroll timeline left"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Reorder.Group
                  axis="x"
                  values={intervals}
                  onReorder={setIntervals}
                  ref={timelineRef as any}
                  className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar scroll-smooth flex-1"
                >
                  {intervals.map((interval) => (
                    <Reorder.Item
                      key={interval.id}
                      value={interval}
                      className="flex flex-col items-center gap-1.5 cursor-grab group flex-shrink-0"
                      onClick={() => {
                        const element = document.querySelector(
                          `[data-interval-id="${interval.id}"]`,
                        );
                        element?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }}
                    >
                      <div
                        className="h-2.5 rounded-full w-16 group-hover:scale-105 transition-all duration-200"
                        style={{
                          backgroundColor: interval.color,
                          boxShadow: `0 0 10px ${interval.color}40`,
                        }}
                      />
                      <p
                        className="text-[10px] font-medium truncate max-w-[70px] text-center leading-tight group-hover:text-text transition-colors"
                        style={{ color: interval.color }}
                      >
                        {interval.name}
                      </p>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollTimeline("right")}
                  className="w-7 h-7 rounded-full flex-shrink-0"
                  aria-label="Scroll timeline right"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <Reorder.Group
              axis="y"
              values={intervals}
              onReorder={setIntervals}
              className="app-scroll pr-2 space-y-2 pb-28 pt-2 custom-scrollbar"
            >
              {intervals.map((interval, index) => (
                <SortableIntervalCard
                  key={interval.id}
                  interval={interval}
                  colorGroups={colorGroups}
                  onDelete={() => deleteInterval(interval.id)}
                  onDuplicate={() => duplicateInterval(index)}
                  onUpdate={(updates) => updateInterval(interval.id, updates)}
                  onOpenPlaylist={() => setEditingIntervalId(interval.id)}
                  onOpenNotes={(id) => setViewingNotesId(id)}
                  audioLibrary={audioLibrary}
                  globalHalfwayAlert={halfwaySoundEnabled}
                />
              ))}
            </Reorder.Group>
          </div>

          {/* Workout Controls Section - Only Let's Go button inside main */}
          <div className="flex-shrink-0">
            {state === "idle" && (
              <Button
                variant="solid"
                size="md"
                onClick={startWorkout}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl py-3 font-black text-base uppercase tracking-[0.2em]"
              >
                <Play size={20} fill="currentColor" />
                Let's go!
              </Button>
            )}
          </div>
        </main>
          </div>
        )}

        {/* Workout Overlay - Shared countdown + active states */}
        {isWorkoutOverlayVisible && (
          <>
            <Overlay />
            <div
              className={cn(
                "fixed inset-0 z-50 flex items-center justify-center p-4",
                isMobileLandscape && "p-2",
              )}
            >
              <motion.div
                layout
                transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
                className={cn(
                  "glass rounded-[2rem] relative overflow-hidden w-full max-w-md h-[min(90vh,38rem)] overflow-y-auto p-6 flex flex-col justify-center items-center text-center",
                  isMobileLandscape && "p-3 h-[min(96vh,32rem)]",
                )}
              >
                <button
                  onClick={resetWorkout}
                  className={cn(
                    "absolute top-6 right-6 p-3 glass rounded-full text-text-muted hover:text-text transition-colors z-30",
                    isMobileLandscape && "top-3 right-3 p-2",
                  )}
                  title={isCountdownState ? "Cancel Countdown" : "Exit Workout"}
                >
                  <X size={isMobileLandscape ? 18 : 24} />
                </button>

                <div
                  className={cn(
                    "absolute top-4 left-4 z-30 flex flex-col items-start gap-1.5",
                    isMobileLandscape && "top-2.5 left-2.5 gap-1",
                  )}
                >
                  {showWorkoutTopControls && (
                    <div
                      className={cn(
                        "flex items-center gap-2",
                        isMobileLandscape && "gap-1.5",
                      )}
                    >
                      {(state === "running" || state === "paused") && (
                        <div
                          className={cn(
                            "glass bg-text-subtle/5 rounded-full px-2 py-1 flex items-center gap-1.5",
                            isMobileLandscape && "gap-1",
                          )}
                        >
                          <Bell
                            size={isMobileLandscape ? 10 : 11}
                            className="text-text-subtle/70"
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              "text-[9px] font-mono uppercase tracking-wider text-text-subtle/70",
                              isMobileLandscape && "text-[7px]",
                            )}
                          >
                            50%
                          </span>
                          <button
                            onClick={toggleCurrentIntervalHalfwayAlert}
                            className={cn(
                              "w-8 h-4 rounded-full relative flex items-center",
                              isMobileLandscape && "w-7 h-[14px]",
                              currentHalfwayAlertEnabled ? "bg-accent" : "bg-text-subtle/40",
                            )}
                            aria-label={
                              currentHalfwayAlertEnabled
                                ? "Disable current interval halfway alert"
                                : "Enable current interval halfway alert"
                            }
                            aria-pressed={currentHalfwayAlertEnabled}
                            title="Toggle 50% alert for current interval"
                          >
                            <span
                              className={cn(
                                "w-2.5 h-2.5 rounded-full bg-text",
                                isMobileLandscape && "w-2 h-2",
                                currentHalfwayAlertEnabled
                                  ? isMobileLandscape
                                    ? "translate-x-3.5"
                                    : "translate-x-4"
                                  : "translate-x-0.5",
                              )}
                            />
                          </button>
                        </div>
                      )}
                      {currentIntervalNotes && (
                        <Button
                          variant="accent"
                          size="xs"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            window.setTimeout(() => {
                              if (currentIntervalId) {
                                setViewingNotesId(currentIntervalId);
                              }
                            }, 0);
                          }}
                          className={cn(
                            "h-6 px-2.5 text-[9px] rounded-full",
                            isMobileLandscape && "h-5 px-2 text-[8px]",
                          )}
                          title="View Interval Notes"
                        >
                          <FileText size={isMobileLandscape ? 9 : 10} />
                          Notes
                        </Button>
                      )}
                    </div>
                  )}
                  <WorkoutDurationStat
                    state={state}
                    totalDuration={totalDuration}
                    remainingSeconds={remainingTotalDuration}
                    compact={isMobileLandscape}
                  />
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {isCountdownState ? (
                    <motion.div
                      key="countdown-content"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="w-full flex flex-col items-center text-center"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={countdownValue}
                          initial={{ scale: 1.08, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.92, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className="text-[10rem] font-mono font-black leading-none"
                          style={{ color: COLORS[0] }}
                        >
                          {countdownValue}
                        </motion.div>
                      </AnimatePresence>
                      <p className="mt-4 text-text-subtle font-mono uppercase tracking-[0.3em] text-sm">
                        Get Ready
                      </p>

                      <NowPlayingPanel
                        song={currentSong}
                        themeColor={themeColor}
                        musicMuted={musicMuted}
                        isMobileLandscape={isMobileLandscape}
                        showTransportControls={false}
                        className="mt-8"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="workout-content"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="w-full pt-10"
                    >
                      {(state === "running" || state === "paused") &&
                        currentInterval?.name && (
                          <motion.p
                            key={`active-interval-name-${currentInterval.id}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={cn(
                              "mx-auto mb-4 max-w-full text-2xl sm:text-3xl font-black tracking-tight leading-tight text-center wrap-break-word",
                              isMobileLandscape && "mb-2 text-xl",
                            )}
                            style={{ color: themeColor }}
                          >
                            {currentInterval.name}
                          </motion.p>
                        )}

                      {/* Progress Ring */}
                      <div
                        key={currentIndex}
                        className={cn(
                          "relative w-48 h-48 flex items-center justify-center mb-4 mx-auto",
                          isMobileLandscape && "w-36 h-36 mb-2",
                        )}
                      >
                  <svg
                    viewBox="0 0 100 100"
                    className="absolute inset-0 w-full h-full -rotate-90"
                  >
                    <circle
                      key={`bg-${currentIndex}`}
                      cx="50"
                      cy="50"
                      r="45"
                      className="fill-none stroke-[6]"
                      style={{ stroke: `${themeColor}20` }}
                    />
                    <motion.circle
                      key={`progress-${currentIndex}`}
                      cx="50"
                      cy="50"
                      r="45"
                      className="fill-none stroke-[6]"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{
                        stroke: themeColor,
                        strokeDashoffset:
                          2 *
                          Math.PI *
                          45 *
                          (1 - clampedIntervalProgress),
                      }}
                      transition={{
                        stroke: { duration: 0.5 },
                        strokeDashoffset:
                          state === "running"
                            ? { duration: 1, ease: "linear" }
                            : { duration: 0 },
                      }}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 45}
                    />
                  </svg>

                  <div className="flex flex-col items-center z-10 px-2">
                    <p
                      className={cn(
                        "text-5xl font-mono font-black tabular-nums text-text leading-none",
                        isMobileLandscape && "text-4xl",
                      )}
                    >
                      {formatClock(safeTimeLeft)}
                    </p>
                  </div>
                </div>

                      <div
                        className={cn(
                          "w-full space-y-4",
                          isMobileLandscape && "space-y-2",
                        )}
                      >
                        <div
                          className={cn(
                            "flex justify-center items-center gap-4",
                            isMobileLandscape && "gap-2",
                          )}
                        >
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={previousInterval}
                            disabled={currentIndex === 0 || state === "finished"}
                            className={cn(
                              "w-12 h-12 rounded-full disabled:opacity-20",
                              isMobileLandscape && "w-10 h-10",
                            )}
                            title="Previous Interval"
                          >
                            <SkipBack size={isMobileLandscape ? 18 : 20} />
                          </Button>
                          <Button
                            variant="white"
                            size="icon"
                            onClick={() => {
                              if (state === "finished") {
                                startWorkout();
                              } else {
                                state === "running"
                                  ? pauseWorkout()
                                  : startWorkout();
                              }
                            }}
                            className={cn(
                              "w-16 h-16 rounded-full",
                              isMobileLandscape && "w-12 h-12",
                            )}
                            title={
                              state === "finished"
                                ? "Restart Workout"
                                : state === "running"
                                  ? "Pause"
                                  : "Resume"
                            }
                          >
                            {state === "finished" ? (
                              <RotateCcw size={isMobileLandscape ? 22 : 28} />
                            ) : state === "running" ? (
                              <Pause
                                size={isMobileLandscape ? 22 : 28}
                                fill="currentColor"
                              />
                            ) : (
                              <Play
                                size={isMobileLandscape ? 22 : 28}
                                className="ml-1"
                                fill="currentColor"
                              />
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={nextInterval}
                            disabled={state === "finished"}
                            className={cn(
                              "w-12 h-12 rounded-full disabled:opacity-20",
                              isMobileLandscape && "w-10 h-10",
                            )}
                            title={
                              currentIndex === intervals.length - 1
                                ? "Finish Workout"
                                : "Skip Interval"
                            }
                          >
                            {currentIndex === intervals.length - 1 ? (
                              <CheckCircle2 size={isMobileLandscape ? 20 : 24} />
                            ) : (
                              <SkipForward size={isMobileLandscape ? 20 : 24} />
                            )}
                          </Button>
                        </div>

                        {/* Interval Progress Cards */}
                        <div className="w-full overflow-hidden">
                          <div
                            ref={countdownTimelineRef}
                            className={cn(
                              "flex gap-2 overflow-x-auto pb-2 custom-scrollbar scroll-smooth flex-nowrap",
                              isMobileLandscape && "gap-1.5 pb-1",
                            )}
                          >
                            {intervals.map((interval, index) => {
                              const isPast =
                                index < currentIndex || state === "finished";
                              const isActive =
                                index === currentIndex && state !== "finished";

                              return (
                                <div
                                  key={interval.id}
                                  ref={(el) => {
                                    intervalRefs.current[index] = el;
                                  }}
                                  className={cn(
                                    "flex flex-col items-center gap-1.5 flex-shrink-0",
                                    isMobileLandscape && "gap-1",
                                  )}
                                >
                                  <div
                                    className="h-2 rounded-full transition-all duration-300"
                                    style={{
                                      width: isMobileLandscape ? "60px" : "80px",
                                      backgroundColor: isActive
                                        ? interval.color
                                        : isPast
                                          ? `${interval.color}60`
                                          : "var(--color-text-subtle)",
                                    }}
                                  />
                                  <p
                                    className={cn(
                                      "text-[10px] font-medium truncate max-w-[80px] text-center",
                                      isMobileLandscape &&
                                        "text-[9px] max-w-[60px]",
                                    )}
                                    style={{
                                      color: isActive
                                        ? interval.color
                                        : isPast
                                          ? "var(--color-text-muted)"
                                          : "var(--color-text-subtle)",
                                    }}
                                  >
                                    {interval.name}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <NowPlayingPanel
                          song={currentSong}
                          themeColor={themeColor}
                          musicMuted={musicMuted}
                          isMobileLandscape={isMobileLandscape}
                          showTransportControls
                          onSkipTrack={skipTrack}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </>
        )}

        {/* Settings Modal */}
        <Modal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          variant="fullscreen"
          title={<h2 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h2>}
          contentClassName="space-y-4 sm:space-y-6"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-text-subtle/60">
              Settings are automatically saved
            </span>
            <div
              className="flex items-center gap-1.5 text-xs text-accent shrink-0"
              aria-live="polite"
            >
              {!user ? (
                <>
                  <Smartphone size={14} />
                  <span>Saved on this device</span>
                </>
              ) : isSavingSettings ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} />
                  <span>Synced to account</span>
                </>
              )}
            </div>
          </div>

          <section className="mt-6">
            <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Volume2 size={14} /> Alarm Settings
            </h3>
            <div className="glass p-4 rounded-2xl space-y-4">
              {/* Volume Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-text-muted/90">
                    Alarm Volume
                  </label>
                  <span className="text-sm font-mono text-text-subtle/60">
                    {Math.round(alarmVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={alarmVolume}
                  onChange={(e) =>
                    setAlarmVolume(parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-text-subtle/20 rounded-lg appearance-none cursor-pointer accent-accent hover:bg-text-subtle/30 transition-colors"
                />
              </div>

              {/* Preset Selector */}
              <div className="space-y-3">
                <label className="text-sm text-text-muted/90 block mb-1">
                  Alarm Sound
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "digital",
                      label: "Digital",
                      desc: "Classic beep",
                    },
                    {
                      value: "chime",
                      label: "Chime",
                      desc: "Soft bell",
                    },
                    {
                      value: "bell",
                      label: "Bell",
                      desc: "Ringing tone",
                    },
                    {
                      value: "buzzer",
                      label: "Buzzer",
                      desc: "Alert buzz",
                    },
                    {
                      value: "custom",
                      label: "Custom",
                      desc: customAlarmName || "Upload file",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() =>
                        setAlarmPreset(
                          preset.value as typeof alarmPreset,
                        )
                      }
                      className={cn(
                        "p-3 rounded-xl border text-left",
                        alarmPreset === preset.value
                          ? "border-accent bg-accent/10"
                          : "border-text-subtle/20 bg-text-subtle/10 hover:border-text-subtle/30",
                      )}
                    >
                      <div className="text-xs font-bold text-text/90">
                        {preset.label}
                      </div>
                      <div className="text-[10px] text-text-subtle/50 truncate">
                        {preset.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom File Upload */}
              {alarmPreset === "custom" && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={alarmFileInputRef}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          await audioEngine.setCustomAlarmFile(file);
                          setCustomAlarmName(file.name);
                        } catch (err) {
                          console.error(
                            "Failed to load custom alarm:",
                            err,
                          );
                        }
                      }
                    }}
                    accept="audio/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => alarmFileInputRef.current?.click()}
                    className="w-full py-3 bg-text-subtle/10 border border-text-subtle/20 rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-text-subtle/20"
                  >
                    <Upload size={16} />
                    {customAlarmName
                      ? "Change Custom Sound"
                      : "Upload Custom Sound"}
                  </button>
                  {customAlarmName && (
                    <div className="flex items-center justify-between p-3 bg-text-subtle/10 rounded-lg">
                      <span className="text-xs text-text-muted/90 truncate">
                        {customAlarmName}
                      </span>
                      <button
                        onClick={() => {
                          audioEngine.clearCustomAlarm();
                          setCustomAlarmName("");
                          setAlarmPreset("digital");
                        }}
                        className="text-text-subtle/40 hover:text-red-400"
                        aria-label="Clear custom alarm"
                      >
                        <MinusCircle size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Test Button */}
              <button
                onClick={() => audioEngine.testAlarm()}
                className="w-full py-3 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-accent hover:bg-accent/20"
              >
                <Play size={16} fill="currentColor" />
                Test Alarm Sound
              </button>
            </div>
          </section>

          {/* Halfway Alert Section */}
          <section className="mt-6">
            <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Bell size={14} /> Halfway Alert
            </h3>
            <div className="glass p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-text-muted/90">
                    50% Interval Alert
                  </label>
                  <p className="text-[10px] text-text-subtle/50">
                    Play sound at halfway point of each interval
                  </p>
                </div>
                <button
                  onClick={() => setHalfwaySoundEnabled((prev) => !prev)}
                  className={cn(
                    "w-11 h-6 rounded-full relative flex items-center",
                    halfwaySoundEnabled ? "bg-accent" : "bg-text-subtle/40",
                  )}
                  aria-label={
                    halfwaySoundEnabled
                      ? "Disable halfway alert"
                      : "Enable halfway alert"
                  }
                  aria-pressed={halfwaySoundEnabled}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full bg-text",
                      halfwaySoundEnabled
                        ? "translate-x-6"
                        : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-text-subtle/10">
                <p className="text-[10px] text-text-subtle/60 leading-relaxed">
                  This is the default setting for all intervals. You can also toggle it per-interval using the 50% switch in each interval card, or during a running workout.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Music size={14} /> Music Control
            </h3>
            <div className="glass p-4 rounded-2xl">
              {/* Mute All Tracks Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-text-muted/90">
                    Mute All Tracks
                  </label>
                  <p className="text-[10px] text-text-subtle/50">
                    Silence interval music, keep countdown beeps
                  </p>
                </div>
                <button
                  onClick={() => setMusicMuted((prev) => !prev)}
                  className={cn(
                    "w-11 h-6 rounded-full relative flex items-center",
                    musicMuted ? "bg-accent" : "bg-text-subtle/40",
                  )}
                  aria-label={
                    musicMuted
                      ? "Unmute all tracks"
                      : "Mute all tracks"
                  }
                  aria-pressed={musicMuted}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full bg-text",
                      musicMuted
                        ? "translate-x-6"
                        : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Theme Toggle Section - Moved below Alarm Settings */}
          <section className="mt-6">
            <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />} Appearance
            </h3>
            <div className="glass p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-text-muted/90">
                    Theme
                  </label>
                  <p className="text-[10px] text-text-subtle/50">
                    {theme === "dark" ? "Dark mode enabled" : "Light mode enabled"}
                  </p>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={cn(
                    "w-14 h-8 rounded-full relative flex items-center p-1",
                    theme === "dark" ? "bg-accent/30" : "bg-accent/30"
                  )}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <span className="sr-only">
                    {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  </span>
                  <motion.span
                    layout
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shadow-sm",
                      theme === "dark" ? "bg-bg translate-x-6" : "bg-text translate-x-0"
                    )}
                  >
                    {theme === "dark" ? (
                      <Moon size={14} className="text-text" />
                    ) : (
                      <Sun size={14} className="text-bg" />
                    )}
                  </motion.span>
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Settings size={14} /> App Information
            </h3>
            <div className="glass p-5 rounded-2xl space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-subtle/50">Version</span>
                <span className="font-mono">1.2.0-responsive</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-subtle/50">Build Date</span>
                <span className="font-mono">OCT 2026</span>
              </div>
            </div>
          </section>
        </Modal>

        <PlaylistDrawer
          isOpen={Boolean(editingIntervalId && intervals.find((i) => i.id === editingIntervalId))}
          interval={intervals.find((i) => i.id === editingIntervalId) || null}
          audioLibrary={audioLibrary}
          onClose={() => setEditingIntervalId(null)}
          onUpdatePlaylist={(updater) => {
            if (editingIntervalId) {
              setIntervals((prev) =>
                prev.map((interval) =>
                  interval.id === editingIntervalId
                    ? { ...interval, playlist: updater(interval.playlist || []) }
                    : interval
                )
              );
            }
          }}
          onFileUpload={handleFileUpload}
          onRemoveAudio={removeAudio}
          isUploading={isUploading}
        />

        {/* Interval Notes Modal */}
        <Modal
          isOpen={!!viewingNotesId}
          onClose={() => setViewingNotesId(null)}
          variant="centered"
          contentClassName="p-4 sm:p-6"
          closeButtonClassName="text-text-subtle/40 hover:text-text"
        >
          {viewingNotesId && (
            <>
              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-subtle/50">
                  Interval Notes
                </span>
                <p className="text-sm font-bold text-text-muted/90 mt-1">
                  {intervals.find((i) => i.id === viewingNotesId)?.name || "Untitled"}
                </p>
              </div>
              <textarea
                autoFocus={!isMobile}
                value={intervals.find((i) => i.id === viewingNotesId)?.notes || ""}
                onChange={(e) => {
                  updateInterval(viewingNotesId, { notes: e.target.value });
                  setNotesAutosaved(true);
                  if (notesAutosaveTimeoutRef.current) {
                    clearTimeout(notesAutosaveTimeoutRef.current);
                  }
                  notesAutosaveTimeoutRef.current = setTimeout(() => {
                    setNotesAutosaved(false);
                    notesAutosaveTimeoutRef.current = null;
                  }, 2000);
                }}
                placeholder="Add notes for this interval..."
                className="w-full h-32 bg-text-subtle/10 border rounded-lg p-3 text-base text-text-muted/90 focus:outline-none resize-none placeholder:text-text-subtle/20 transition-all focus:ring-2 focus:border-transparent"
                style={{
                  borderColor: `${intervals.find((i) => i.id === viewingNotesId)?.color || "#ffffff"}20`,
                }}
              />
              <div
                className="mt-2 flex items-center gap-1.5 text-xs text-text-subtle/60"
                aria-live="polite"
              >
                <CheckCircle2
                  size={12}
                  className={cn(
                    "shrink-0",
                    notesAutosaved ? "text-accent" : "text-accent/70",
                  )}
                  aria-hidden="true"
                />
                <span className={notesAutosaved ? "text-accent" : undefined}>
                  {notesAutosaved
                    ? "Saved"
                    : "Notes are saved automatically"}
                </span>
              </div>
            </>
          )}
        </Modal>

        {/* Delete Workout Confirmation */}
        <AnimatePresence>
          {workoutToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setWorkoutToDelete(null)}
              className="fixed inset-0 z-[150] bg-bg/60 backdrop-blur-sm cursor-pointer"
            />
          )}
        </AnimatePresence>
        <ConfirmModal
          isOpen={workoutToDelete !== null}
          onClose={() => setWorkoutToDelete(null)}
          title="Delete Saved Timeline?"
          message={`Are you sure you want to delete "${workoutToDelete?.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            if (workoutToDelete) {
              deleteSavedWorkout(workoutToDelete.id);
            }
          }}
          confirmVariant="danger"
          showOverlay={false}
          className="z-[200]"
        />

        <ConfirmModal
          isOpen={showUnsavedChanges}
          onClose={() => setShowUnsavedChanges(false)}
          title="Unsaved Changes?"
          message="You have unsaved changes. Save this workout before going back?"
          cancelLabel="Don't Save"
          confirmLabel="Save"
          confirmVariant="solid"
          onCancel={leaveWithoutSaving}
          onConfirm={() => {
            void handleSaveWorkout();
          }}
        />

        {/* Login Prompt Dialog */}
        <LoginModal
          isOpen={showLoginPrompt}
          onClose={() => setShowLoginPrompt(false)}
        />
      </div>
    </motion.div>
  )}
</AnimatePresence>
);
}
