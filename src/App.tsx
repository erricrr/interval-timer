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
  Activity,
  TrendingUp,
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
  Square,
  LogOut,
  GripVertical,
  MoreVertical,
  Trash2,
  Volume2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, Interval, WorkoutState, COLORS, buildColorGroups, getGroupForInterval, ColorGroup } from "./lib/utils";
import { audioEngine } from "./lib/audio";

// --- Components ---

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
    className="p-3 glass rounded-full text-white/60 hover:text-white transition-colors"
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
    primary: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
    secondary:
      "bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-white/5",
    ghost: "text-white/40 hover:text-white/80 hover:bg-white/5",
    accent:
      "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20",
    solid:
      "bg-accent text-bg hover:bg-accent/90 border-none",
    white: "bg-white text-bg hover:bg-white/90 border-none",
    danger:
      "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
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

interface IntervalCardProps {
  key?: React.Key;
  interval: Interval;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updates: Partial<Interval>) => void;
  onOpenPlaylist: () => void;
  onOpenNotes: (id: string) => void;
  audioLibrary: { id: string; name: string }[];
}

const IntervalCard = ({
  interval,
  onDelete,
  onDuplicate,
  onUpdate,
  onOpenPlaylist,
  onOpenNotes,
  audioLibrary,
}: IntervalCardProps) => {
  const dragControls = useDragControls();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const x = useMotionValue(0);
  const controls = useAnimation();
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = -80; // Threshold to snap open
  const snapOpenX = -100; // How far the card slides to reveal buttons
  const snapClosedX = 0;

  const mins = Math.floor(interval.duration / 60);
  const secs = interval.duration % 60;

  const isAnyMenuOpen = showColorPicker || showActions;

  // Close swipe when clicking outside
  useEffect(() => {
    if (x.get() < -10) {
      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          controls.start({ x: snapClosedX, transition: { type: "spring", stiffness: 500, damping: 30 } });
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
  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const currentX = x.get();
    const velocity = info.velocity.x;

    // If dragged past threshold or with high velocity to the left, snap open
    if (currentX < swipeThreshold || (velocity < -500 && currentX < -20)) {
      controls.start({ x: snapOpenX, transition: { type: "spring", stiffness: 500, damping: 30 } });
    } else {
      // Snap closed
      controls.start({ x: snapClosedX, transition: { type: "spring", stiffness: 500, damping: 30 } });
    }
  };

  return (
    <Reorder.Item
      value={interval}
      dragListener={false}
      dragControls={dragControls}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      style={{ zIndex: isAnyMenuOpen ? 50 : 1, position: "relative" }}
      className={cn(
        "glass rounded-2xl overflow-hidden",
        isAnyMenuOpen && "z-50",
      )}
      data-interval-id={interval.id}
    >
      <div ref={cardRef} className="relative flex flex-row">
        {/* Background Action Buttons - revealed on swipe */}
        <div className="absolute inset-0 flex justify-end items-stretch">
          <button
            onClick={() => {
              onDuplicate();
              controls.start({ x: snapClosedX, transition: { type: "spring", stiffness: 500, damping: 30 } });
            }}
            className="w-[50px] sm:w-[60px] bg-white/10 hover:bg-white/20 flex flex-col items-center justify-center gap-1 transition-colors border-l border-white/5"
            aria-label="Duplicate interval"
          >
            <Copy size={20} className="text-white/70" />
          </button>
          <button
            onClick={() => {
              onDelete();
              controls.start({ x: snapClosedX, transition: { type: "spring", stiffness: 500, damping: 30 } });
            }}
            className="w-[50px] sm:w-[60px] bg-red-500/20 hover:bg-red-500/30 flex flex-col items-center justify-center gap-1 transition-colors border-l border-white/5"
            aria-label="Remove interval"
          >
            <Trash2 size={20} className="text-red-400" />
          </button>
        </div>

        {/* Swipeable Card Content */}
        <motion.div
          drag="x"
          dragConstraints={{ left: -100, right: 0 }}
          dragElastic={{ left: 0.1, right: 0 }}
          onDragEnd={handleDragEnd}
          animate={controls}
          style={{ x }}
          className="flex flex-1 flex-row bg-bg relative z-10 group"
        >
          {/* Full Height Drag Handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="w-10 flex items-center justify-center cursor-grab active:cursor-grabbing text-white/10 hover:text-white/30 hover:bg-white/5 transition-all border-r border-white/5 shrink-0 touch-none"
          >
            <GripVertical size={20} />
          </div>

          <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2 relative">
            {/* 3 Dot Menu - Absolute positioned top right */}
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowActions(!showActions)}
                className="w-7 h-7 sm:w-8 sm:h-8 text-white/40 hover:text-white"
              >
                <MoreVertical size={16} />
              </Button>

              <AnimatePresence>
                {showActions && (
                  <>
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setShowActions(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: 5 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 5 }}
                      className="fixed z-[70] glass border border-white/10 rounded-xl p-1 w-36 overflow-hidden"
                      style={{
                        right: '44px',
                        top: '8px',
                      }}
                    >
                      <button
                        onClick={() => {
                          onDuplicate();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left"
                      >
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <div className="h-px bg-white/5 mx-1" />
                      <button
                        onClick={() => {
                          onDelete();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Main Row: Color | Title | Time */}
            <div className="flex items-center gap-3 pr-10">
              {/* Color Indicator & Picker */}
              <div className="relative shrink-0">
                <button
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
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowColorPicker(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: -10 }}
                          className="absolute left-full ml-3 -top-3 z-40 glass border border-white/10 rounded-xl p-2 grid grid-cols-5 gap-2 w-[160px]"
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
                                ? "border-white"
                                : "border-transparent",
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Title Input */}
              <div className="flex-1 min-w-0">
                <input
                  value={interval.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="Interval Title"
                  className="bg-transparent border-none p-0 font-bold text-sm sm:text-base text-white/90 focus:ring-0 focus:outline-none w-full placeholder:text-white/10 truncate"
                />
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
                    className="w-8 sm:w-10 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-right text-xl sm:text-2xl font-mono font-black text-white tabular-nums selection:bg-accent/30"
                  />
                  <span className="text-[8px] sm:text-[9px] font-black text-white/50 uppercase tracking-wider">
                    m
                  </span>
                </div>
                <span className="text-lg sm:text-xl font-mono text-white/20">
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
                      let val = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                      if (val > 59) val = 59;
                      if (val < 0) val = 0;
                      onUpdate({ duration: mins * 60 + val });
                    }}
                    className="w-8 sm:w-10 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-right text-xl sm:text-2xl font-mono font-black text-white tabular-nums selection:bg-accent/30"
                  />
                  <span className="text-[8px] sm:text-[9px] font-black text-white/50 uppercase tracking-wider">
                    s
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Section: Track Count & Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-white/5">
              <div
                className="flex items-center gap-2 text-[10px] font-mono"
                style={{ color: (interval.playlist || []).length > 0 ? interval.color : 'rgba(255,255,255,0.4)' }}
              >
                <Music size={12} />
                <span>{(interval.playlist || []).length} Tracks</span>
              </div>

              <Button
                variant="secondary"
                size="xs"
                onClick={onOpenPlaylist}
                className="h-5 px-2 text-[9px]"
              >
                <Plus size={10} />
                Add
              </Button>

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
    </Reorder.Item>
  );
};

interface PlaylistDrawerProps {
  interval: Interval;
  audioLibrary: { id: string; name: string }[];
  onClose: () => void;
  onUpdate: (updates: Partial<Interval>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAudio: (id: string) => void;
  isUploading?: boolean;
}

const PlaylistDrawer = ({
  interval,
  audioLibrary,
  onClose,
  onUpdate,
  onFileUpload,
  onRemoveAudio,
  isUploading = false,
}: PlaylistDrawerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        className="fixed right-0 top-0 bottom-0 w-full max-w-md glass border-l border-white/10 z-[101] flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white">
              Edit Tracks
            </h2>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">
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
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Current Tracks
              </h3>
              <span className="text-[10px] font-mono text-white/30">
                {(interval.playlist || []).length} Total
              </span>
            </div>

            <Reorder.Group
              axis="y"
              values={interval.playlist || []}
              onReorder={(newPlaylist) => onUpdate({ playlist: newPlaylist })}
              className="space-y-2"
            >
              {(interval.playlist || []).length === 0 ? (
                <div className="p-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                  <Music size={24} className="text-white/10" />
                  <p className="text-xs text-white/20 italic">
                    No songs in playlist
                  </p>
                </div>
              ) : (
                (interval.playlist || []).map((track) => {
                  const audio = audioLibrary.find(
                    (a) => a.id === track.audioId,
                  );
                  if (!audio) return null;
                  return (
                    <Reorder.Item
                      key={track.instanceId}
                      value={track}
                      className="glass p-3 rounded-xl flex items-center gap-3 group/item border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="text-white/10 group-hover/item:text-white/30 transition-colors cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white/80 truncate">
                          {formatAudioName(audio.name)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const nextPlaylist = (interval.playlist || []).filter(
                            (t) => t.instanceId !== track.instanceId,
                          );
                          onUpdate({ playlist: nextPlaylist });
                        }}
                        className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <X size={14} />
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
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
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
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
                <p className="text-[10px] text-white/20 italic text-center py-4">
                  No songs in library
                </p>
              ) : (
                audioLibrary.map((audio) => (
                  <div
                    key={audio.id}
                    className="flex items-center gap-1"
                  >
                    {/* Main clickable area - adds to playlist */}
                    <button
                      onClick={() =>
                        onUpdate({
                          playlist: [
                            ...(interval.playlist || []),
                            {
                              instanceId: Math.random().toString(36).substr(2, 9),
                              audioId: audio.id,
                            },
                          ],
                        })
                      }
                      className="flex-1 flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all text-left overflow-hidden min-w-0"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 text-accent shrink-0">
                        <Music size={14} />
                      </div>
                      <span className="flex-1 text-xs text-white/70 truncate min-w-0">
                        {formatAudioName(audio.name)}
                      </span>
                      <div className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-[var(--interval-color)] transition-colors shrink-0">
                        <Plus size={16} />
                      </div>
                    </button>
                    {/* Separate delete button */}
                    <button
                      onClick={() => onRemoveAudio(audio.id)}
                      className="p-3 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Remove from library"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-white/10">
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
      </motion.div>
    </>
  );
};

export default function App() {
  const [workoutTitle, setWorkoutTitle] = useState("TempoTread Session");
  const [intervals, setIntervals] = useState<Interval[]>([
    { id: "1", name: "Warm Up", duration: 10, notes: "", color: COLORS[1] },
    { id: "2", name: "Sprint", duration: 10, notes: "", color: COLORS[3] },
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

  // Alarm settings state
  const [alarmVolume, setAlarmVolume] = useState(0.5);
  const [alarmPreset, setAlarmPreset] = useState<"digital" | "chime" | "bell" | "buzzer" | "custom">("digital");
  const [customAlarmName, setCustomAlarmName] = useState("");
  const [halfwaySoundEnabled, setHalfwaySoundEnabled] = useState(false);
  const alarmFileInputRef = useRef<HTMLInputElement>(null);

  // Compute color groups from intervals
  const colorGroups = useMemo(() => buildColorGroups(intervals), [intervals]);

  const timerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tempotread_workouts");
    if (saved) {
      try {
        setSavedWorkouts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved workouts from localStorage");
      }
    }

    // Load alarm settings
    const savedAlarmSettings = localStorage.getItem("tempotread_alarm_settings");
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
    localStorage.setItem("tempotread_workouts", JSON.stringify(savedWorkouts));
  }, [savedWorkouts]);

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

  const saveCurrentWorkout = () => {
    const newWorkout = {
      id: Math.random().toString(36).substr(2, 9),
      title: workoutTitle,
      intervals: [...intervals],
    };
    setSavedWorkouts((prev) => [newWorkout, ...prev]);
  };

  const loadWorkout = (workout: {
    id: string;
    title: string;
    intervals: Interval[];
  }) => {
    setWorkoutTitle(workout.title);
    setIntervals(workout.intervals);
    setShowSettings(false);
  };

  const deleteSavedWorkout = (id: string) => {
    setSavedWorkouts((prev) => prev.filter((w) => w.id !== id));
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
      const prevGroup = getGroupForInterval(colorGroups, prevIndex);
      const currentGroup = getGroupForInterval(colorGroups, currentIndex);
      const isSameGroup = prevGroup && currentGroup && prevGroup.startIndex === currentGroup.startIndex;

      setCurrentIndex(prevIndex);
      setTimeLeft(prev.duration);
      audioEngine.stopAll();
      audioEngine.playStart();
      // Restart audio for the previous interval's group
      if (prevGroup && prevGroup.mergedPlaylist.length > 0) {
        audioEngine.playPlaylist(prevGroup.mergedPlaylist, prevGroup.totalDuration);
      }
    }
  };

  const nextInterval = () => {
    if (currentIndex < intervals.length - 1) {
      const nextIndex = currentIndex + 1;
      const next = intervals[nextIndex];
      const nextGroup = getGroupForInterval(colorGroups, nextIndex);
      const currentGroup = getGroupForInterval(colorGroups, currentIndex);
      const isSameGroup = nextGroup && currentGroup && nextGroup.startIndex === currentGroup.startIndex;

      setCurrentIndex(nextIndex);
      setTimeLeft(next.duration);
      audioEngine.stopAll();
      audioEngine.playStart();
      // Restart audio for the next interval's group
      if (nextGroup && nextGroup.mergedPlaylist.length > 0) {
        audioEngine.playPlaylist(nextGroup.mergedPlaylist, nextGroup.totalDuration);
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
      const supportedExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.ogv'];
      const unsupportedFiles: string[] = [];
      const supportedFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (supportedExtensions.includes(ext)) {
          supportedFiles.push(file);
        } else {
          unsupportedFiles.push(file.name);
        }
      }

      if (unsupportedFiles.length > 0) {
        alert(`The following file types are not supported:\n${unsupportedFiles.join('\n')}\n\nPlease use MP3, WAV, or OGG files only.`);
      }

      try {
        for (const file of supportedFiles) {
          await audioEngine.addCustomAudio(file);
        }
        setAudioLibrary(audioEngine.getAudioLibrary());
      } catch (err) {
        console.error("Failed to load audio:", err);
        alert("Failed to load audio file(s). Please ensure they are valid MP3, WAV, or OGG files.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeAudio = (id: string) => {
    audioEngine.removeAudio(id);
    setAudioLibrary(audioEngine.getAudioLibrary());
    // Clear audioId from intervals that used it
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
            if (halfwaySoundEnabled && next === Math.floor(currentInterval.duration / 2)) {
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
                const currentGroup = getGroupForInterval(colorGroups, currentIndex);
                const nextGroup = getGroupForInterval(colorGroups, nextIndex);
                const isSameGroup = currentGroup && nextGroup && currentGroup.startIndex === nextGroup.startIndex;

                setCurrentIndex(nextIndex);

                if (isSameGroup) {
                  // Same color group - continue playing without stopping
                  setTimeout(() => {
                    audioEngine.playStart();
                  }, 500);
                } else {
                  // Different color group - stop and start new group audio
                  audioEngine.stopAll();
                  setTimeout(() => {
                    audioEngine.playStart();
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
  }, [state, currentIndex, currentInterval, intervals, colorGroups, halfwaySoundEnabled]);

  const addInterval = () => {
    const newInterval: Interval = {
      id: Math.random().toString(36).substr(2, 9),
      name: "New Interval",
      duration: 60,
      notes: "",
      color: COLORS[intervals.length % COLORS.length],
    };
    setIntervals([...intervals, newInterval]);
  };

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      const scrollAmount = 200;
      timelineRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
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

  return (
    <div className="min-h-screen bg-bg text-white font-sans antialiased selection:bg-accent/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto flex flex-col p-4 md:p-8 lg:p-12 min-h-screen">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 lg:mb-8">
          <div className="flex-1 w-full max-w-md lg:max-w-4xl">
            <input
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              className="text-xl md:text-3xl lg:text-5xl font-black tracking-tighter text-accent bg-transparent border-none p-0 focus:ring-0 w-full uppercase truncate"
            />
          </div>
          <div className="flex items-center justify-between w-full sm:w-auto gap-6">
            <div className="sm:hidden text-left">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">
                {state === "running" || state === "paused" || state === "countdown" ? "Remaining" : "Total Duration"}
              </p>
              <p className="text-lg font-mono text-white/80">
                {state === "running" || state === "paused" || state === "countdown"
                  ? `${Math.floor((totalDuration - totalTimeElapsed) / 60)}:${((totalDuration - totalTimeElapsed) % 60).toString().padStart(2, "0")}`
                  : `${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, "0")}`}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 sm:p-4 glass rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95"
              title="Settings & Library"
            >
              <Settings size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
          {/* Left Column: Timeline */}
          <div
            className={cn(
              "lg:col-span-7 space-y-3 sm:space-y-4 pb-20 lg:pb-0",
              state !== "idle" &&
                "hidden lg:block opacity-20 pointer-events-none blur-[2px] transition-all duration-700",
            )}
          >
            {/* Workout Timeline Guide - Sticky with Navigation */}
            <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-sm py-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:bg-transparent lg:backdrop-blur-none lg:static">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollTimeline('left')}
                  className="w-7 h-7 rounded-full flex-shrink-0"
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
                        const element = document.querySelector(`[data-interval-id="${interval.id}"]`);
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                        className="text-[10px] font-medium truncate max-w-[70px] text-center leading-tight group-hover:text-white transition-colors"
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
                  onClick={() => scrollTimeline('right')}
                  className="w-7 h-7 rounded-full flex-shrink-0"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <Reorder.Group
              axis="y"
              values={intervals}
              onReorder={setIntervals}
              className="space-y-2 lg:overflow-y-auto lg:max-h-[calc(100vh-320px)] pr-2"
            >
              <AnimatePresence mode="popLayout">
                {intervals.map((interval) => (
                  <IntervalCard
                    key={interval.id}
                    interval={interval}
                    onDelete={() => deleteInterval(interval.id)}
                    onDuplicate={() =>
                      duplicateInterval(intervals.indexOf(interval))
                    }
                    onUpdate={(updates) => updateInterval(interval.id, updates)}
                    onOpenPlaylist={() => setEditingIntervalId(interval.id)}
                    onOpenNotes={(id) => setViewingNotesId(id)}
                    audioLibrary={audioLibrary}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>

            <Button
              variant="secondary"
              onClick={addInterval}
              className="w-full py-3 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 group mt-2"
            >
              <Plus
                size={16}
                className="group-hover:scale-110 transition-transform text-white/40"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-white/40 group-hover:text-white/80">
                Add Interval
              </span>
            </Button>
          </div>

          {/* Right Column: Active State / Controls */}
          <div className="lg:col-span-5 lg:sticky lg:top-12">
            {state === "idle" ? (
              <Button
                variant="solid"
                size="md"
                onClick={startWorkout}
                className="fixed bottom-4 left-4 right-4 lg:static lg:w-full rounded-2xl py-3 font-black text-base uppercase tracking-[0.2em] shadow-2xl z-30"
              >
                <Play size={20} fill="currentColor" />
                Let's go!
              </Button>
            ) : state === "countdown" ? (
              <div className="glass p-6 lg:p-8 rounded-[2rem] flex flex-col justify-center items-center text-center min-h-[320px]">
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
                <p className="mt-4 text-white/40 font-mono uppercase tracking-[0.3em] text-sm">
                  Get Ready
                </p>

                {currentSong && (
                  <div className="mt-8 w-full max-w-xs">
                    <p className="text-[10px] font-mono text-white/40 uppercase mb-3 flex items-center justify-center gap-2">
                      <Music
                        size={12}
                        className="animate-pulse"
                        style={{ color: themeColor }}
                      />{" "}
                      Now Playing
                    </p>
                    <div className="glass bg-white/5 p-4 rounded-2xl">
                      <p className="text-sm font-bold truncate mb-2">
                        {currentSong.name}
                      </p>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
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
            ) : (
              <div className="glass p-6 lg:p-8 rounded-[2rem] flex flex-col justify-center items-center text-center relative overflow-hidden">
                {/* Exit Button */}
                <button
                  onClick={resetWorkout}
                  className="absolute top-6 right-6 p-3 glass rounded-full text-white/60 hover:text-white transition-colors z-20"
                  title="Exit Workout"
                >
                  <X size={24} />
                </button>

                {/* Timer Display */}
                <div className="flex flex-col items-center mb-4 sm:mb-6">
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.3em] mb-2">
                    {state === "finished" ? "FINISHED" : "NOW"}
                  </p>
                  <h1
                    className="text-3xl sm:text-4xl md:text-5xl font-black text-center mb-1"
                    style={{ color: themeColor }}
                  >
                    {state === "finished" ? "Workout Complete" : currentInterval.name}
                  </h1>
                  {currentIndex < intervals.length - 1 &&
                    state !== "finished" && (
                      <p className="text-sm text-white/30 font-medium">
                        Next: {intervals[currentIndex + 1].name}
                      </p>
                    )}
                </div>

                {/* Progress Ring */}
                <div
                  key={currentIndex}
                  className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72 flex items-center justify-center mb-4 sm:mb-6"
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

                  <div className="flex flex-col items-center z-10">
                    <p className="text-6xl sm:text-7xl md:text-8xl font-mono font-black tabular-nums text-white">
                      {Math.floor(timeLeft / 60)}:
                      {(timeLeft % 60).toString().padStart(2, "0")}
                    </p>
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-2">
                      LEFT
                    </p>
                  </div>
                </div>

                {currentInterval.notes && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 glass border p-3 rounded-2xl max-w-md w-full text-center"
                    style={{
                      backgroundColor: `${currentInterval.color}10`,
                      borderColor: `${currentInterval.color}20`,
                    }}
                  >
                    <div
                      className="flex items-center justify-center gap-2 mb-2"
                      style={{ color: `${currentInterval.color}90` }}
                    >
                      <FileText size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Interval Notes
                      </span>
                    </div>
                    <p className="text-xs text-white/70 italic leading-relaxed break-words">
                      {currentInterval.notes}
                    </p>
                  </motion.div>
                )}

                <div className="w-full space-y-4">
                  <div className="flex justify-center items-center gap-4 sm:gap-6">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={previousInterval}
                      disabled={currentIndex === 0 || state === "finished"}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full disabled:opacity-20"
                      title="Previous Interval"
                    >
                      <SkipBack size={20} className="sm:w-6 sm:h-6" />
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
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
                      title={
                        state === "finished"
                          ? "Restart Workout"
                          : state === "running"
                            ? "Pause"
                            : "Resume"
                      }
                    >
                      {state === "finished" ? (
                        <RotateCcw size={28} className="sm:w-8 sm:h-8" />
                      ) : state === "running" ? (
                        <Pause
                          size={28}
                          className="sm:w-8 sm:h-8"
                          fill="currentColor"
                        />
                      ) : (
                        <Play
                          size={28}
                          className="sm:w-8 sm:h-8 ml-1"
                          fill="currentColor"
                        />
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={nextInterval}
                      disabled={state === "finished"}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full disabled:opacity-20"
                      title={
                        currentIndex === intervals.length - 1
                          ? "Finish Workout"
                          : "Skip Interval"
                      }
                    >
                      {currentIndex === intervals.length - 1 ? (
                        <CheckCircle2 size={24} className="sm:w-7 sm:h-7" />
                      ) : (
                        <SkipForward size={24} className="sm:w-7 sm:h-7" />
                      )}
                    </Button>
                  </div>

                  {/* Interval Progress Cards */}
                  <div className="w-full overflow-hidden">
                    <div className="flex gap-2 sm:gap-2.5 justify-center flex-wrap">
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
                              className="h-2 sm:h-2.5 rounded-full transition-all duration-300"
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
                              className="text-[10px] sm:text-xs font-medium truncate max-w-[80px] sm:max-w-[100px] text-center"
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
                    <div className="glass bg-white/5 p-6 rounded-2xl text-left">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
                          <Music size={12} style={{ color: themeColor }} /> Now
                          Playing
                        </p>
                        <span className="text-[10px] font-mono text-white/20">
                          {currentSong.index + 1} / {currentSong.totalSongs}
                        </span>
                      </div>
                      <p className="text-sm font-bold truncate mb-3">
                        {currentSong.name}
                      </p>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${(currentSong.currentTime / currentSong.duration) * 100}%`,
                            backgroundColor: themeColor,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-white/30">
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
            )}
          </div>
        </main>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-xl p-4 md:p-8 flex flex-col items-center justify-center"
            >
              <div className="w-full max-w-2xl flex flex-col h-full max-h-[90vh] glass p-5 md:p-6 rounded-[2.5rem] neo-shadow relative">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">
                    System Settings
                  </h2>
                  <CloseButton onClose={() => setShowSettings(false)} />
                </div>

                <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar flex-1">
                  <section>
                    <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Save size={14} /> Save Current Timeline
                    </h3>
                    <button
                      onClick={saveCurrentWorkout}
                      className="w-full py-4 glass rounded-2xl flex items-center justify-center gap-3 text-accent hover:bg-accent/10 transition-all border border-accent/20"
                    >
                      <Save size={20} />
                      <span className="font-bold">Save "{workoutTitle}"</span>
                    </button>
                  </section>

                  {savedWorkouts.length > 0 && (
                    <section>
                      <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FolderOpen size={14} /> Saved Timelines
                      </h3>
                      <div className="space-y-2">
                        {savedWorkouts.map((workout) => (
                          <div
                            key={workout.id}
                            className="glass p-4 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-colors"
                          >
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => loadWorkout(workout)}
                            >
                              <p className="font-bold text-lg">
                                {workout.title}
                              </p>
                              <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                                {workout.intervals.length} Intervals •{" "}
                                {Math.floor(
                                  workout.intervals.reduce(
                                    (acc, i) => acc + i.duration,
                                    0,
                                  ) / 60,
                                )}
                                m
                              </p>
                            </div>
                            <button
                              onClick={() => deleteSavedWorkout(workout.id)}
                              className="p-3 text-white/20 hover:text-red-400 transition-colors"
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
                    <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Volume2 size={14} /> Alarm Settings
                    </h3>
                    <div className="glass p-4 rounded-2xl space-y-4">
                      {/* Volume Slider */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm text-white/70">Alarm Volume</label>
                          <span className="text-sm font-mono text-white/50">{Math.round(alarmVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={alarmVolume}
                          onChange={(e) => setAlarmVolume(parseFloat(e.target.value))}
                          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent hover:bg-white/20 transition-colors"
                        />
                      </div>

                      {/* Preset Selector */}
                      <div className="space-y-3">
                        <label className="text-sm text-white/70">Alarm Sound</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { value: "digital", label: "Digital", desc: "Classic beep" },
                            { value: "chime", label: "Chime", desc: "Soft bell" },
                            { value: "bell", label: "Bell", desc: "Ringing tone" },
                            { value: "buzzer", label: "Buzzer", desc: "Alert buzz" },
                            { value: "custom", label: "Custom", desc: customAlarmName || "Upload file" },
                          ].map((preset) => (
                            <button
                              key={preset.value}
                              onClick={() => setAlarmPreset(preset.value as typeof alarmPreset)}
                              className={cn(
                                "p-3 rounded-xl border text-left transition-all",
                                alarmPreset === preset.value
                                  ? "border-accent bg-accent/10"
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              )}
                            >
                              <div className="text-xs font-bold text-white/90">{preset.label}</div>
                              <div className="text-[10px] text-white/40 truncate">{preset.desc}</div>
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
                                  console.error("Failed to load custom alarm:", err);
                                }
                              }
                            }}
                            accept="audio/*"
                            className="hidden"
                          />
                          <button
                            onClick={() => alarmFileInputRef.current?.click()}
                            className="w-full py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-white/10 transition-colors"
                          >
                            <Upload size={16} />
                            {customAlarmName ? "Change Custom Sound" : "Upload Custom Sound"}
                          </button>
                          {customAlarmName && (
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                              <span className="text-xs text-white/70 truncate">{customAlarmName}</span>
                              <button
                                onClick={() => {
                                  audioEngine.clearCustomAlarm();
                                  setCustomAlarmName("");
                                  setAlarmPreset("digital");
                                }}
                                className="text-white/30 hover:text-red-400 transition-colors"
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
                        className="w-full py-3 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
                      >
                        <Play size={16} fill="currentColor" />
                        Test Alarm Sound
                      </button>

                      {/* Halfway Sound Toggle */}
                      <div className="flex items-center justify-between py-3 border-t border-white/10">
                        <div>
                          <label className="text-sm text-white/70">Halfway Alert</label>
                          <p className="text-[10px] text-white/40">Sound when interval reaches 50%</p>
                        </div>
                        <button
                          onClick={() => setHalfwaySoundEnabled(!halfwaySoundEnabled)}
                          className={cn(
                            "w-11 h-6 rounded-full transition-colors relative flex items-center",
                            halfwaySoundEnabled ? "bg-accent" : "bg-white/20"
                          )}
                        >
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full bg-white transition-transform",
                              halfwaySoundEnabled ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Settings size={14} /> App Information
                    </h3>
                    <div className="glass p-5 rounded-2xl space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Version</span>
                        <span className="font-mono">1.2.0-responsive</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Build Date</span>
                        <span className="font-mono">MAR 2026</span>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-full py-4 bg-accent text-bg font-black rounded-2xl uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform"
                  >
                    SAVE & CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editingIntervalId && (
            <PlaylistDrawer
              interval={intervals.find((i) => i.id === editingIntervalId)!}
              audioLibrary={audioLibrary}
              onClose={() => setEditingIntervalId(null)}
              onUpdate={(updates) => updateInterval(editingIntervalId, updates)}
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
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99]"
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
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Interval Notes
                      </span>
                      <p className="text-sm font-bold text-white/80 mt-1">
                        {intervals.find((i) => i.id === viewingNotesId)?.name ||
                          "Untitled"}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewingNotesId(null)}
                      className="text-white/30 hover:text-white"
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
                    className="w-full h-32 bg-white/5 border rounded-lg p-3 text-sm text-white/80 focus:outline-none resize-none placeholder:text-white/10 transition-all focus:ring-2 focus:border-transparent"
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
      </div>
    </div>
  );
}
