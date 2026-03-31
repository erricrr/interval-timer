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
  Save,
  FolderOpen,
  SkipForward,
  SkipBack,
  CheckCircle2,
  GripVertical,
  MoreVertical,
  Trash2,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sun,
  Moon,
} from "lucide-react";
import { cn, Interval, WorkoutState, COLORS, buildColorGroups, getGroupForInterval, ColorGroup, PlaylistTrack } from "./lib/utils";
import { audioEngine } from "./lib/audio";
import { LoginButton } from "./components/LoginButton";
import { auth } from "./lib/firebase";
import {
  saveSettings,
  loadSettings,
  saveWorkout,
  saveNewWorkout,
  loadWorkout,
  uploadAudioTrack,
  deleteAudioTrack,
  loadAudioLibrary,
  uploadCustomAlarm,
  saveWorkoutToLibrary,
  loadSavedWorkouts,
  deleteSavedWorkoutFromLibrary,
  saveOrReplaceWorkout,
} from "./lib/firebaseSync";
import type { Settings as FirebaseSettings } from "./lib/firebaseSync";

// Custom hook for detecting clicks outside an element
function useClickOutside(
  isOpen: boolean,
  onClose: () => void,
  excludeRefs: React.RefObject<HTMLElement | null>[]
) {
  // Store refs in a ref to maintain stable reference
  const refsRef = useRef(excludeRefs);
  refsRef.current = excludeRefs;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Check if click is inside any excluded element (menu or trigger button)
      const isInsideExcluded = refsRef.current.some(
        (ref) => ref.current && ref.current.contains(target)
      );
      if (!isInsideExcluded) {
        onClose();
      }
    };

    // Use pointerdown for both mouse and touch, capture phase to ensure we get it first
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, onClose]);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "accent"
    | "solid"
    | "white"
    | "upload";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
};

const CloseButton = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="p-3 glass rounded-full text-text-muted hover:text-text"
    aria-label="Close"
  >
    <X size={24} />
  </button>
);

const Button = ({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) => {
  const variants = {
    primary: "bg-text-subtle/20 text-text hover:bg-text-subtle/30 border border-text-subtle/20",
    secondary:
      "bg-text-subtle/10 text-text-muted hover:text-text hover:bg-text-subtle/20 border border-text-subtle/10",
    ghost: "text-text-subtle hover:text-text hover:bg-text-subtle/10",
    accent:
      "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20",
    solid: "bg-accent text-bg hover:bg-accent/90 border-none",
    white: "bg-text text-bg hover:bg-text/90 border-none",
    danger:
      "bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 border border-rose-400/20",
    upload:
      "bg-accent text-bg hover:bg-accent/90 border-none shadow-lg shadow-accent/20",
  };

  const sizes = {
    xs: "px-2 py-1 text-[10px] uppercase tracking-wider font-medium",
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-8 py-5 text-lg font-black tracking-[0.2em]",
    icon: "p-2",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

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

  // Get the merged playlist for this interval's color group
  const colorGroup = useMemo(() =>
    getGroupForInterval(colorGroups, interval.color),
    [colorGroups, interval.color]
  );
  const mergedPlaylist = colorGroup?.mergedPlaylist || [];
  const trackCount = mergedPlaylist.length;

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
            onPointerDown={(e) => dragControls.start(e)}
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

            {/* Main Row: Color | Title | Time */}
            <div className="flex items-center gap-3 pr-10">
              {/* Color Indicator & Picker */}
              <div className="relative shrink-0">
                <button
                  ref={colorButtonRef}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-1.5 h-8 sm:h-10 rounded-full shrink-0 shadow-lg transition-transform hover:scale-110 active:scale-95"
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
                  className="bg-transparent border-none p-0 font-bold text-sm sm:text-base text-text/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg w-full placeholder:text-text-subtle/30 truncate"
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
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                    className="w-8 sm:w-10 bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-right text-xl sm:text-2xl font-mono font-black text-text tabular-nums selection:bg-accent/30"
                  />
                  <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider">
                    m
                  </span>
                </div>
                <span className="text-lg sm:text-xl font-mono text-text-subtle">
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
                    className="w-8 sm:w-10 bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-right text-xl sm:text-2xl font-mono font-black text-text tabular-nums selection:bg-accent/30"
                  />
                  <span className="text-[8px] sm:text-[9px] font-black text-text-muted uppercase tracking-wider">
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
  interval: Interval;
  colorGroups: ColorGroup[];
  audioLibrary: { id: string; name: string }[];
  onClose: () => void;
  onUpdatePlaylist: (playlist: PlaylistTrack[]) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAudio: (id: string) => void;
  isUploading?: boolean;
}

const PlaylistDrawer = ({
  interval,
  colorGroups,
  audioLibrary,
  onClose,
  onUpdatePlaylist,
  onFileUpload,
  onRemoveAudio,
  isUploading = false,
}: PlaylistDrawerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioToDelete, setAudioToDelete] = useState<{ id: string; name: string } | null>(null);

  // Get the merged playlist for this interval's color group
  const colorGroup = useMemo(() =>
    getGroupForInterval(colorGroups, interval.color),
    [colorGroups, interval.color]
  );
  const mergedPlaylist = colorGroup?.mergedPlaylist || [];

  const formatAudioName = (name: string) => {
    // Remove file extension
    return name.replace(/\.[^/.]+$/, "");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        style={{ "--interval-color": interval.color } as React.CSSProperties}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md glass border-l border-text-subtle/10 z-[101] flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-text-subtle/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-text">
              Edit Tracks
            </h2>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mt-1">
              Interval:{" "}
              <span style={{ color: interval.color }}>
                {interval.name || "Untitled"}
              </span>
            </p>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Current Playlist */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
                Current Tracks
              </h3>
              <span className="text-[10px] font-mono text-text-subtle">
                {mergedPlaylist.length} Total
              </span>
            </div>

            <Reorder.Group
              axis="y"
              values={mergedPlaylist}
              onReorder={(newPlaylist) => onUpdatePlaylist(newPlaylist)}
              className="space-y-2"
            >
              {mergedPlaylist.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-text-subtle/10 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                  <Music size={24} className="text-text-subtle/30" />
                  <p className="text-xs text-text-subtle/50 italic">
                    No songs in playlist
                  </p>
                </div>
              ) : (
                mergedPlaylist.map((track) => {
                  const audio = audioLibrary.find(
                    (a) => a.id === track.audioId,
                  );
                  if (!audio) return null;
                  return (
                    <Reorder.Item
                      key={track.instanceId}
                      value={track}
                      className="glass p-3 rounded-xl flex items-center gap-3 group/item border border-text-subtle/10 hover:border-text-subtle/20 transition-colors"
                    >
                      <div className="text-text-subtle group-hover/item:text-text-muted transition-colors cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-text/80 truncate">
                          {formatAudioName(audio.name)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const nextPlaylist = mergedPlaylist.filter(
                            (t) => t.instanceId !== track.instanceId,
                          );
                          onUpdatePlaylist(nextPlaylist);
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
                        onUpdatePlaylist([
                          ...mergedPlaylist,
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
        </div>

        <div className="p-6 border-t border-text-subtle/10">
          <Button
            variant="solid"
            className="w-full py-4 bg-accent text-bg font-black rounded-2xl uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform"
            onClick={onClose}
            style={{
              backgroundColor: interval.color,
            }}
          >
            Done
          </Button>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {audioToDelete && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[102]"
                onClick={() => setAudioToDelete(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-[103] flex items-center justify-center pointer-events-none p-4"
              >
                <div className="glass border border-text-subtle/10 rounded-2xl p-6 max-w-sm w-full pointer-events-auto shadow-2xl">
                  <div className="flex items-start gap-3 mb-4">

                    <div>
                      <h3 className="text-lg font-bold text-text mb-1">
                        Delete Audio Track?
                      </h3>
                      <p className="text-sm text-text-muted">
                        Are you sure you want to delete{" "}
                        <span className="text-text font-medium">
                          {formatAudioName(audioToDelete.name)}
                        </span>
                        ? This will also remove it from any intervals using this track.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      className="flex-1 py-3"
                      onClick={() => setAudioToDelete(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 py-3"
                      onClick={() => {
                        onRemoveAudio(audioToDelete.id);
                        setAudioToDelete(null);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default function App() {
  const [workoutTitle, setWorkoutTitle] = useState("TempoTread Session");
  const [intervals, setIntervals] = useState<Interval[]>([
    { id: "1", name: "Warm Up", duration: 10, notes: "", color: COLORS[1] },
    { id: "2", name: "Run", duration: 10, notes: "", color: COLORS[3] },
    { id: "3", name: "Recovery", duration: 10, notes: "", color: COLORS[2] },
  ]);

  const [state, setState] = useState<WorkoutState>("idle");
  const [countdownValue, setCountdownValue] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [currentSong, setCurrentSong] = useState<{
    name: string;
    duration: number;
    currentTime: number;
    index: number;
    totalSongs: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [audioLibrary, setAudioLibrary] = useState<
    { id: string; name: string }[]
  >([]);
  const [editingIntervalId, setEditingIntervalId] = useState<string | null>(
    null,
  );
  const [viewingNotesId, setViewingNotesId] = useState<string | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<
    { id: string; title: string; intervals: Interval[] }[]
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewWorkoutConfirm, setShowNewWorkoutConfirm] = useState(false);

  // Firebase auth state
  const [user, setUser] = useState(auth.currentUser);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [audioStoragePaths, setAudioStoragePaths] = useState<Record<string, string>>({});

  // Alarm settings state
  const [alarmVolume, setAlarmVolume] = useState(0.5);
  const [alarmPreset, setAlarmPreset] = useState<
    "digital" | "chime" | "bell" | "buzzer" | "custom"
  >("digital");
  const [customAlarmName, setCustomAlarmName] = useState("");
  const [halfwaySoundEnabled, setHalfwaySoundEnabled] = useState(false);
  const alarmFileInputRef = useRef<HTMLInputElement>(null);

  // Save confirmation states
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [timelineSaved, setTimelineSaved] = useState(false);

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

  // Compute color groups from intervals
  const colorGroups = useMemo(() => buildColorGroups(intervals), [intervals]);

  const timerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load-on-login: fetch user data from Firebase in parallel
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      setIsDataLoading(true);
      try {
        // Load critical data in parallel
        const [workoutData, settings, workouts] = await Promise.all([
          loadWorkout(user.uid),
          loadSettings(user.uid),
          loadSavedWorkouts(user.uid).catch(() => []),
        ]);

        if (workoutData) {
          setWorkoutTitle(workoutData.workoutTitle?.trim() || "TempoTread Session");
          setIntervals(workoutData.intervals || []);
        }

        if (settings) {
          setAlarmVolume(settings.alarmVolume);
          setAlarmPreset(settings.alarmPreset);
          setCustomAlarmName(settings.customAlarmName);
          setHalfwaySoundEnabled(settings.halfwaySoundEnabled);
        }

        setSavedWorkouts(workouts);
      } finally {
        setIsDataLoading(false);
      }
    };

    // Load audio library in background (non-blocking)
    const loadAudio = async () => {
      try {
        const audioEntries = await loadAudioLibrary(user.uid);
        const paths: Record<string, string> = {};
        await Promise.all(
          audioEntries.map(async (entry) => {
            try {
              await audioEngine.addAudioFromURL(entry.id, entry.name, entry.downloadURL);
              paths[entry.id] = entry.storagePath;
            } catch (audioErr) {
              console.error(`Failed to load audio ${entry.name}:`, audioErr);
            }
          })
        );
        setAudioStoragePaths(paths);
        setAudioLibrary(audioEngine.getAudioLibrary());
      } catch (err) {
        console.error("Failed to load audio library:", err);
      }
    };

    loadUserData();
    loadAudio(); // Non-blocking
  }, [user]);

  useEffect(() => {
    // Only load from localStorage if user is not logged in (fallback)
    if (user) return;

    const saved = localStorage.getItem("tempotread_workouts");
    if (saved) {
      try {
        setSavedWorkouts(JSON.parse(saved));
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
      } catch (e) {
        console.error("Failed to load alarm settings from localStorage");
      }
    }
  }, []);

  useEffect(() => {
    // Only persist to localStorage when user is not logged in
    if (!user) {
      localStorage.setItem("tempotread_workouts", JSON.stringify(savedWorkouts));
    }
  }, [savedWorkouts, user]);

  // Save alarm settings when they change
  useEffect(() => {
    const settings = {
      volume: alarmVolume,
      preset: alarmPreset,
      customAlarmName: customAlarmName,
      halfwaySoundEnabled: halfwaySoundEnabled,
    };
    localStorage.setItem("tempotread_alarm_settings", JSON.stringify(settings));
    audioEngine.setAlarmVolume(alarmVolume);
    audioEngine.setAlarmPreset(alarmPreset);
  }, [alarmVolume, alarmPreset, customAlarmName, halfwaySoundEnabled]);

  const saveCurrentWorkout = async () => {
    const newWorkout = {
      id: Math.random().toString(36).substr(2, 9),
      title: workoutTitle,
      intervals: [...intervals],
    };

    // If logged in, save to Firestore first
    if (user) {
      try {
        await saveWorkoutToLibrary(user.uid, newWorkout);
      } catch (err) {
        console.error("Failed to save workout to Firestore:", err);
        // Still update local state even if Firestore fails
      }
    }

    setSavedWorkouts((prev) => [newWorkout, ...prev]);
  };

  const loadSavedWorkout = (workout: {
    id: string;
    title: string;
    intervals: Interval[];
  }) => {
    setWorkoutTitle(workout.title);
    setIntervals(workout.intervals);
    setShowSettings(false);
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

  const clearWorkout = () => {
    setWorkoutTitle("TempoTread Session");
    setIntervals([]);
    resetWorkout();
    setShowNewWorkoutConfirm(false);
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
  const totalDuration = useMemo(
    () => intervals.reduce((acc, i) => acc + i.duration, 0),
    [intervals],
  );

  const startWorkout = () => {
    if (intervals.length === 0) return;

    if (state === "idle" || state === "finished") {
      if (state === "finished") {
        resetWorkout();
      }
      setState("countdown");
      setCountdownValue(3);
      audioEngine.playCountdown(3);
    } else if (state === "paused") {
      setState("running");
      audioEngine.resumePlaylist();
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
    setTotalTimeElapsed(0);
    setCountdownValue(0);
    audioEngine.stopAll();
  };

  const previousInterval = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prev = intervals[prevIndex];
      const current = intervals[currentIndex];
      const isSameColor = prev.color === current.color;

      setCurrentIndex(prevIndex);
      setTimeLeft(prev.duration);
      audioEngine.stopAll();
      audioEngine.playStart();
      // Restart audio for the previous interval's color group
      if (!isSameColor) {
        const prevGroup = getGroupForInterval(colorGroups, prev.color);
        if (prevGroup && prevGroup.mergedPlaylist.length > 0) {
          audioEngine.playPlaylist(
            prevGroup.mergedPlaylist,
            prevGroup.totalDuration,
          );
        }
      }
    }
  };

  const nextInterval = () => {
    if (currentIndex < intervals.length - 1) {
      const nextIndex = currentIndex + 1;
      const next = intervals[nextIndex];
      const current = intervals[currentIndex];
      const isSameColor = next.color === current.color;

      setCurrentIndex(nextIndex);
      setTimeLeft(next.duration);
      audioEngine.stopAll();
      audioEngine.playStart();
      // Restart audio for the next interval's color group
      if (!isSameColor) {
        const nextGroup = getGroupForInterval(colorGroups, next.color);
        if (nextGroup && nextGroup.mergedPlaylist.length > 0) {
          audioEngine.playPlaylist(
            nextGroup.mergedPlaylist,
            nextGroup.totalDuration,
          );
        }
      }
    } else {
      audioEngine.playWorkoutComplete();
      audioEngine.stopAll();
      setState("finished");
    }
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

          if (user) {
            // Upload to Firebase when logged in
            try {
              const entry = await uploadAudioTrack(user.uid, file, id);
              await audioEngine.addAudioFromURL(entry.id, entry.name, entry.downloadURL);
              setAudioStoragePaths((prev) => ({ ...prev, [id]: entry.storagePath }));
            } catch (err) {
              console.error("Failed to upload/load Firebase audio:", err);
              alert("Audio uploaded to cloud but couldn't load due to CORS. Falling back to local.");
              // Fallback to local
              await audioEngine.addCustomAudio(file);
            }
          } else {
            // Fallback: local only
            await audioEngine.addCustomAudio(file);
          }
        }
        setAudioLibrary(audioEngine.getAudioLibrary());
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

  const removeAudio = (id: string) => {
    // Fire Firebase delete in background if user is logged in
    if (user && audioStoragePaths[id]) {
      deleteAudioTrack(user.uid, id, audioStoragePaths[id]);
      setAudioStoragePaths((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }

    // Local cleanup (synchronous)
    audioEngine.removeAudio(id);
    setAudioLibrary(audioEngine.getAudioLibrary());
    // Clear audioId from any intervals that used this track
    setIntervals(
      intervals.map((i) => ({
        ...i,
        playlist: i.playlist?.filter((track) => track.audioId !== id),
      })),
    );
  };

  useEffect(() => {
    let songPolling: number;
    if (state === "running" || state === "countdown") {
      songPolling = window.setInterval(() => {
        setCurrentSong(audioEngine.getCurrentSongInfo());
      }, 500);
    } else {
      setCurrentSong(null);
    }
    return () => clearInterval(songPolling);
  }, [state]);

  useEffect(() => {
    if (state === "countdown") {
      const timer = setInterval(() => {
        setCountdownValue((prev) => {
          const next = prev - 1;
          if (next > 0) {
            audioEngine.playCountdown(next);
            return next;
          } else {
            clearInterval(timer);
            setState("running");
            setCurrentIndex(0);
            setTimeLeft(intervals[0].duration);
            audioEngine.playStart();
            // Start first group's audio
            const firstGroup = colorGroups[0];
            if (firstGroup && firstGroup.mergedPlaylist.length > 0) {
              audioEngine.playPlaylist(
                firstGroup.mergedPlaylist,
                firstGroup.totalDuration,
              );
            }
            return 0;
          }
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, intervals, colorGroups]);

  useEffect(() => {
    if (state === "running") {
      const tick = (now: number) => {
        if (!lastTickRef.current) lastTickRef.current = now;
        const delta = now - lastTickRef.current;

        if (delta >= 1000) {
          setTimeLeft((prev) => {
            const next = prev - 1;

            // Audio Cues
            const shouldPlayHalfway =
              currentInterval.halfwayAlert ?? halfwaySoundEnabled;
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
              if (currentIndex < intervals.length - 1) {
                audioEngine.playEnd();

                const nextIndex = currentIndex + 1;
                const nextInterval = intervals[nextIndex];
                const currentInterval = intervals[currentIndex];
                const isSameColor = nextInterval.color === currentInterval.color;

                setCurrentIndex(nextIndex);

                if (isSameColor) {
                  // Same color group - continue playing without stopping
                  setTimeout(() => {
                    audioEngine.playStart();
                  }, 500);
                } else {
                  // Different color group - stop and start new group audio
                  audioEngine.stopAll();
                  setTimeout(() => {
                    audioEngine.playStart();
                    const nextGroup = getGroupForInterval(colorGroups, nextInterval.color);
                    if (nextGroup && nextGroup.mergedPlaylist.length > 0) {
                      audioEngine.playPlaylist(
                        nextGroup.mergedPlaylist,
                        nextGroup.totalDuration,
                      );
                    }
                  }, 500);
                }
                return nextInterval.duration;
              } else {
                audioEngine.playWorkoutComplete();
                audioEngine.stopAll();
                setState("finished");
                return 0;
              }
            }
            return next;
          });
          setTotalTimeElapsed((prev) => prev + 1);
          lastTickRef.current = now;
        }
        timerRef.current = requestAnimationFrame(tick);
      };
      timerRef.current = requestAnimationFrame(tick);
    } else {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      lastTickRef.current = 0;
    }
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [
    state,
    currentIndex,
    currentInterval,
    intervals,
    colorGroups,
    halfwaySoundEnabled,
  ]);

  const addInterval = () => {
    const newInterval: Interval = {
      id: Math.random().toString(36).substr(2, 9),
      name: "New Interval",
      duration: 60,
      notes: "",
      color: COLORS[intervals.length % COLORS.length],
      halfwayAlert: undefined, // Will inherit from global default
    };
    setIntervals([...intervals, newInterval]);
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

  const updatePlaylistForColorGroup = (intervalColor: string, playlist: PlaylistTrack[]) => {
    // Update the playlist for ALL intervals with the same color
    setIntervals(
      intervals.map((i) => (i.color === intervalColor ? { ...i, playlist } : i)),
    );
  };

  const deleteInterval = (id: string) => {
    setIntervals(intervals.filter((i) => i.id !== id));
  };

  const updateInterval = (id: string, updates: Partial<Interval>) => {
    setIntervals(
      intervals.map((i) => (i.id === id ? { ...i, ...updates } : i)),
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
          className="min-h-screen bg-bg text-text font-sans antialiased flex items-center justify-center"
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
          className="min-h-screen bg-bg text-text font-sans antialiased selection:bg-accent/30 overflow-x-hidden"
        >
          <div className="max-w-7xl mx-auto flex flex-col p-4 md:p-8 lg:p-12 min-h-screen">
        <header className="flex flex-col gap-4 mb-4 lg:mb-8">
          {/* Top Row: App Title + Actions */}
          <div className="flex items-center justify-between">
            {/* App Title */}
            <div className="flex items-center gap-2 text-accent">
              <Timer size={24} className="sm:w-7 sm:h-7" />
              <span className="text-lg sm:text-xl font-black tracking-tight uppercase">
                TempoTread
              </span>
            </div>

            {/* Login & Settings */}
            <div className="flex items-center gap-2">
              <LoginButton />
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 sm:p-3 glass rounded-full text-text-muted hover:text-text hover:bg-text-subtle/10 transition-all hover:scale-110 active:scale-95"
                title="Settings & Library"
              >
                <Settings size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Sticky Workout Title & Duration - Outside flex container */}
        <div className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md py-3 border-b border-text-subtle/10 -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
            <input
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              className="text-xl md:text-3xl lg:text-5xl font-black tracking-tighter text-accent bg-transparent border-none p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg w-full uppercase truncate"
              aria-label="Workout title"
            />
            <div className="flex items-end justify-between mt-1">
              <div className="text-left">
                <p className="text-[10px] text-text-subtle font-mono uppercase tracking-widest">
                  {state === "running" ||
                  state === "paused" ||
                  state === "countdown"
                    ? "Remaining"
                    : "Total Duration"}
                </p>
                <p className="text-lg font-mono text-text-muted">
                  {state === "running" ||
                  state === "paused" ||
                  state === "countdown"
                    ? `${Math.floor((totalDuration - totalTimeElapsed) / 60)}:${((totalDuration - totalTimeElapsed) % 60).toString().padStart(2, "0")}`
                    : `${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, "0")}`}
                </p>
              </div>

              {/* New Workout Button */}
              <button
                onClick={() => setShowNewWorkoutConfirm(true)}
                className="py-1.5 px-3 glass rounded-lg flex items-center gap-1.5 text-text-muted hover:text-text hover:bg-text-subtle/10 transition-all border border-text-subtle/10 text-[10px] font-bold uppercase tracking-wider mr-4"
                title="Start new workout"
              >
                <Plus size={12} />
                 New Session
              </button>
              {user && (
                <button
                  onClick={async () => {
                    try {
                      const titleToSave = workoutTitle?.trim() || "TempoTread Session";
                      // Use saveOrReplaceWorkout to handle duplicates
                      const result = await saveOrReplaceWorkout(user.uid, {
                        workoutTitle: titleToSave,
                        intervals,
                      }, savedWorkouts);
                      // Update local state - replace if exists, otherwise add
                      const newWorkout = { id: result.id, title: titleToSave, intervals };
                      setSavedWorkouts(prev => {
                        const filtered = prev.filter(w => w.id !== result.id);
                        return [newWorkout, ...filtered];
                      });
                      setTimelineSaved(true);
                      setTimeout(() => setTimelineSaved(false), 2000);
                    } catch (err) {
                      console.error("Timeline SAVE failed:", err);
                      alert("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
                    }
                  }}
                  className="py-1.5 px-3 glass rounded-lg flex items-center gap-1.5 text-accent hover:bg-accent/10 transition-all border border-accent/20 text-[10px] font-bold uppercase tracking-wider"
                >
                  <Save size={12} />
                  {timelineSaved ? "Saved!" : "Save"}
                </button>
              )}
            </div>
          </div>

        <main className="flex-1 flex flex-col gap-4">
          {/* Timeline Section */}
          <div className="flex flex-col h-[calc(100vh-280px)]">
            {/* Workout Timeline Guide - Sticky with Navigation */}
            <div className="sticky top-0 z-20 bg-bg py-2 -mx-4 px-4 border-b border-text-subtle/10">
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
              className="flex-1 overflow-y-auto pr-2 space-y-2 pb-44 pt-2"
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

          {/* Add Interval Button - Fixed above Let's Go */}
          <button
            onClick={addInterval}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 py-1.5 px-10 bg-bg rounded-full flex items-center justify-center gap-2 border border-text-subtle/40 cursor-pointer"
          >
            <Plus
              size={14}
              className="text-text-subtle"
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-subtle">
              Interval
            </span>
          </button>

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

        {/* Countdown Overlay - Outside main */}
        {state === "countdown" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 rounded-[2rem] flex flex-col justify-center items-center text-center min-h-[320px] max-w-md w-full">
              <motion.div
                key={countdownValue}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="text-[10rem] font-mono font-black leading-none"
                style={{ color: COLORS[0] }}
              >
                {countdownValue}
              </motion.div>
              <p className="mt-4 text-text-subtle font-mono uppercase tracking-[0.3em] text-sm">
                Get Ready
              </p>

              {currentSong && (
                <div className="mt-8 w-full max-w-xs">
                  <p className="text-[10px] font-mono text-text-subtle uppercase mb-3 flex items-center justify-center gap-2">
                    <Music
                      size={12}
                      className="animate-pulse"
                      style={{ color: themeColor }}
                    />{" "}
                    Now Playing
                  </p>
                  <div className="glass bg-text-subtle/5 p-4 rounded-2xl">
                    <p className="text-sm font-bold truncate mb-2">
                      {currentSong.name}
                    </p>
                    <div className="w-full h-1.5 bg-text-subtle/10 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${(currentSong.currentTime / currentSong.duration) * 100}%`,
                          backgroundColor: themeColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workout Timer Overlay - Outside main */}
        {(state === "running" || state === "paused" || state === "finished") && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 rounded-[2rem] flex flex-col justify-center items-center text-center relative overflow-hidden w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Exit Button */}
                <button
                  onClick={resetWorkout}
                  className="absolute top-6 right-6 p-3 glass rounded-full text-text-muted hover:text-text transition-colors z-20"
                  title="Exit Workout"
                >
                  <X size={24} />
                </button>

                {/* Timer Display */}
                <div className="flex flex-col items-center mb-4">
                  <p className="text-[10px] font-mono text-text-subtle uppercase tracking-[0.3em] mb-2">
                    {state === "finished" ? "FINISHED" : "NOW"}
                  </p>
                  <h1
                    className="text-3xl font-black text-center mb-1"
                    style={{ color: themeColor }}
                  >
                    {state === "finished"
                      ? "Workout Complete"
                      : currentInterval.name}
                  </h1>
                  {currentIndex < intervals.length - 1 &&
                    state !== "finished" && (
                      <p className="text-sm text-text-subtle/70 font-medium">
                        Next: {intervals[currentIndex + 1].name}
                      </p>
                    )}
                </div>

                {/* Progress Ring */}
                <div
                  key={currentIndex}
                  className="relative w-48 h-48 flex items-center justify-center mb-4"
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
                          (1 - timeLeft / currentInterval.duration),
                      }}
                      transition={{
                        stroke: { duration: 0.5 },
                        strokeDashoffset: { duration: 1, ease: "linear" },
                      }}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 45}
                    />
                  </svg>

                  <div className="flex flex-col items-center z-10 px-2">
                    <p className="text-5xl font-mono font-black tabular-nums text-text leading-none">
                      {Math.floor(timeLeft / 60)}:
                      {(timeLeft % 60).toString().padStart(2, "0")}
                    </p>
                    <p className="text-[9px] font-mono text-text-subtle/70 uppercase tracking-[0.2em] mt-1.5">
                      LEFT
                    </p>
                  </div>
                </div>

                {currentInterval.notes && state !== "finished" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 glass border p-2.5 rounded-2xl max-w-md w-full text-center"
                    style={{
                      backgroundColor: `${currentInterval.color}10`,
                      borderColor: `${currentInterval.color}20`,
                    }}
                  >
                    <div
                      className="flex items-center justify-center gap-2 mb-1.5"
                      style={{ color: `${currentInterval.color}90` }}
                    >
                      <FileText size={11} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Interval Notes
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted/90 italic break-words">
                      {currentInterval.notes}
                    </p>
                  </motion.div>
                )}

                <div className="w-full space-y-4">
                  <div className="flex justify-center items-center gap-4">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={previousInterval}
                      disabled={currentIndex === 0 || state === "finished"}
                      className="w-12 h-12 rounded-full disabled:opacity-20"
                      title="Previous Interval"
                    >
                      <SkipBack size={20} />
                    </Button>
                    <Button
                      variant="white"
                      size="icon"
                      onClick={() => {
                        if (state === "finished") {
                          startWorkout();
                        } else {
                          state === "running" ? pauseWorkout() : startWorkout();
                        }
                      }}
                      className="w-16 h-16 rounded-full"
                      title={
                        state === "finished"
                          ? "Restart Workout"
                          : state === "running"
                            ? "Pause"
                            : "Resume"
                      }
                    >
                      {state === "finished" ? (
                        <RotateCcw size={28} />
                      ) : state === "running" ? (
                        <Pause
                          size={28}
                          fill="currentColor"
                        />
                      ) : (
                        <Play
                          size={28}
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
                      className="w-12 h-12 rounded-full disabled:opacity-20"
                      title={
                        currentIndex === intervals.length - 1
                          ? "Finish Workout"
                          : "Skip Interval"
                      }
                    >
                      {currentIndex === intervals.length - 1 ? (
                        <CheckCircle2 size={24} />
                      ) : (
                        <SkipForward size={24} />
                      )}
                    </Button>
                  </div>

                  {/* Interval Progress Cards */}
                  <div className="w-full overflow-hidden">
                    <div className="flex gap-2 justify-center flex-wrap">
                      {intervals.map((interval, index) => {
                        const isPast =
                          index < currentIndex || state === "finished";
                        const isActive =
                          index === currentIndex && state !== "finished";
                        const mins = Math.floor(interval.duration / 60);
                        const secs = (interval.duration % 60)
                          .toString()
                          .padStart(2, "0");

                        return (
                          <div
                            key={interval.id}
                            className="flex flex-col items-center gap-1.5"
                          >
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(80, Math.max(40, 120 / intervals.length))}px`,
                                backgroundColor: isActive
                                  ? interval.color
                                  : isPast
                                    ? `${interval.color}60`
                                    : "rgba(255,255,255,0.1)",
                              }}
                            />
                            <p
                              className="text-[10px] font-medium truncate max-w-[80px] text-center"
                              style={{
                                color: isActive
                                  ? interval.color
                                  : isPast
                                    ? "rgba(255,255,255,0.5)"
                                    : "rgba(255,255,255,0.3)",
                              }}
                            >
                              {interval.name}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {currentSong && (
                    <div className="glass bg-text-subtle/5 p-4 rounded-2xl text-left">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-mono text-text-subtle/70 uppercase tracking-wider flex items-center gap-1.5">
                          <Music size={11} style={{ color: themeColor }} /> Now
                          Playing
                        </p>
                        <span className="text-[10px] font-mono text-text-subtle/30">
                          {currentSong.index + 1} / {currentSong.totalSongs}
                        </span>
                      </div>
                      <p className="text-sm font-bold truncate mb-2">
                        {currentSong.name}
                      </p>
                      <div className="w-full h-1.5 bg-text-subtle/10 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${(currentSong.currentTime / currentSong.duration) * 100}%`,
                            backgroundColor: themeColor,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-text-subtle/40">
                        <span>
                          {Math.floor(currentSong.currentTime / 60)}:
                          {Math.floor(currentSong.currentTime % 60)
                            .toString()
                            .padStart(2, "0")}
                        </span>
                        <span>
                          {Math.floor(currentSong.duration / 60)}:
                          {Math.floor(currentSong.duration % 60)
                            .toString()
                            .padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-xl p-4 flex flex-col items-center justify-center"
            >
              <div className="w-full max-w-2xl flex flex-col h-full max-h-[90vh] glass p-5 rounded-[2.5rem] neo-shadow relative">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">
                    System Settings
                  </h2>
                  <CloseButton onClose={() => setShowSettings(false)} />
                </div>

                <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar flex-1">
                  <section>
                    <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Save size={14} /> Save Current Timeline
                    </h3>
                    <button
                      onClick={async () => {
                        try {
                          const titleToSave = workoutTitle?.trim() || "TempoTread Session";
                          // Use saveOrReplaceWorkout to handle duplicates
                          const result = await saveOrReplaceWorkout(user.uid, {
                            workoutTitle: titleToSave,
                            intervals,
                          }, savedWorkouts);
                          // Update local state - replace if exists, otherwise add
                          const newWorkout = { id: result.id, title: titleToSave, intervals };
                          setSavedWorkouts(prev => {
                            const filtered = prev.filter(w => w.id !== result.id);
                            return [newWorkout, ...filtered];
                          });
                          // Show brief success feedback
                          const btn = document.activeElement as HTMLButtonElement;
                          if (btn) {
                            const originalText = btn.innerHTML;
                            btn.innerHTML = `<span class="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>Saved!</span>`;
                            setTimeout(() => {
                              btn.innerHTML = originalText;
                            }, 1500);
                          }
                        } catch (err) {
                          console.error("Save failed:", err);
                          alert("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
                        }
                      }}
                      className="w-full py-4 bg-accent text-bg font-black rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 shadow-lg shadow-accent/20 mx-1"
                    >
                      <Save size={20} />
                      <span className="font-bold">Save "{workoutTitle}"</span>
                    </button>
                  </section>

                  {savedWorkouts.length > 0 && (
                    <section>
                      <h3 className="text-xs font-mono text-text-subtle/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FolderOpen size={14} /> Saved Timelines
                      </h3>
                      <div className="space-y-2">
                        {savedWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="glass p-4 rounded-2xl flex items-center justify-between group hover:bg-text-subtle/10"
                          >
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => loadSavedWorkout(workout)}
                            >
                              <p className="font-bold text-lg">
                                {workout.title}
                              </p>
                              <p className="text-[10px] font-mono text-text-subtle/40 uppercase tracking-wider">
                                {workout.intervals.length} Intervals •{" "}
                                {(() => {
                                  const totalSeconds = workout.intervals.reduce(
                                    (acc, i) => acc + i.duration,
                                    0,
                                  );
                                  const mins = Math.floor(totalSeconds / 60);
                                  const secs = totalSeconds % 60;
                                  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
                                })()}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteSavedWorkout(workout.id)}
                              className="p-3 text-text-subtle/30 hover:text-red-400"
                              title="Delete Saved Workout"
                            >
                              <MinusCircle size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
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
                        <label className="text-sm text-text-muted/90">
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

                      {/* Halfway Sound Toggle */}
                      <div className="flex items-center justify-between py-3 border-t border-text-subtle/10">
                        <div>
                          <label className="text-sm text-text-muted/90">
                            Halfway Alert
                          </label>
                          <p className="text-[10px] text-text-subtle/50">
                            Sound when interval reaches 50%
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setHalfwaySoundEnabled(!halfwaySoundEnabled)
                          }
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

                      {/* Save Settings Button */}
                      {user && (
                        <div className="pt-4 border-t border-text-subtle/10">
                          <button
                            onClick={async () => {
                              // Save workout data using saveOrReplaceWorkout
                              const titleToSave = workoutTitle?.trim() || "TempoTread Session";
                              const result = await saveOrReplaceWorkout(user.uid, {
                                workoutTitle: titleToSave,
                                intervals,
                              }, savedWorkouts);
                              // Update local state - replace if exists, otherwise add
                              const newWorkout = { id: result.id, title: titleToSave, intervals };
                              setSavedWorkouts(prev => {
                                const filtered = prev.filter(w => w.id !== result.id);
                                return [newWorkout, ...filtered];
                              });
                              // Save alarm settings separately
                              await saveSettings(user.uid, {
                                alarmVolume,
                                alarmPreset,
                                customAlarmName,
                                customAlarmStoragePath: null,
                                halfwaySoundEnabled,
                              });
                              setSettingsSaved(true);
                              setTimeout(() => setSettingsSaved(false), 2000);
                            }}
                            className="w-full py-3 bg-accent text-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-accent/20"
                          >
                            <Save size={16} />
                            {settingsSaved ? "Saved!" : "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Theme Toggle Section - Moved below Alarm Settings */}
                  <section>
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

                  <section>
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
                        <span className="font-mono">MAR 2026</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editingIntervalId && (
            <PlaylistDrawer
              interval={intervals.find((i) => i.id === editingIntervalId)!}
              colorGroups={colorGroups}
              audioLibrary={audioLibrary}
              onClose={() => setEditingIntervalId(null)}
              onUpdatePlaylist={(playlist) => {
                const interval = intervals.find((i) => i.id === editingIntervalId);
                if (interval) {
                  updatePlaylistForColorGroup(interval.color, playlist);
                }
              }}
              onFileUpload={handleFileUpload}
              onRemoveAudio={removeAudio}
              isUploading={isUploading}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {viewingNotesId && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-text-subtle/60 backdrop-blur-sm z-[99]"
                onClick={() => setViewingNotesId(null)}
              />
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 300,
                }}
                className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
              >
                <motion.div
                  className="glass border rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto w-full max-w-md pointer-events-auto"
                  style={{
                    borderColor: `${intervals.find((i) => i.id === viewingNotesId)?.color || "#ffffff"}20`,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-subtle/50">
                        Interval Notes
                      </span>
                      <p className="text-sm font-bold text-text-muted/90 mt-1">
                        {intervals.find((i) => i.id === viewingNotesId)?.name ||
                          "Untitled"}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewingNotesId(null)}
                      className="text-text-subtle/40 hover:text-text"
                      aria-label="Close notes"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    autoFocus
                    value={
                      intervals.find((i) => i.id === viewingNotesId)?.notes ||
                      ""
                    }
                    onChange={(e) =>
                      updateInterval(viewingNotesId, { notes: e.target.value })
                    }
                    placeholder="Add notes for this interval..."
                    className="w-full h-32 bg-text-subtle/10 border rounded-lg p-3 text-sm text-text-muted/90 focus:outline-none resize-none placeholder:text-text-subtle/20 transition-all focus:ring-2 focus:border-transparent"
                    style={{
                      borderColor: `${intervals.find((i) => i.id === viewingNotesId)?.color || "#ffffff"}20`,
                      ringColor: intervals.find((i) => i.id === viewingNotesId)
                        ?.color,
                      ringOpacity: 0.5,
                    }}
                  />
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* New Workout Confirmation Dialog */}
        <AnimatePresence>
          {showNewWorkoutConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-text-subtle/60 backdrop-blur-sm z-[110]"
                onClick={() => setShowNewWorkoutConfirm(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-[111] flex items-center justify-center pointer-events-none p-4"
              >
                <div className="glass border border-text-subtle/10 rounded-2xl p-6 max-w-sm w-full pointer-events-auto shadow-2xl">
                  <div className="flex items-start gap-3 mb-4">

                    <div>
                      <h3 className="text-lg font-bold text-text mb-1">
                        Start New Workout?
                      </h3>
                      <p className="text-sm text-text-muted">
                        This will clear all current intervals and reset the workout title. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      className="flex-1 py-3"
                      onClick={() => setShowNewWorkoutConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 py-3"
                      onClick={clearWorkout}
                    >
                      Clear & Start New
                    </Button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )}
</AnimatePresence>
);
}
