import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
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
  Trash2
} from 'lucide-react';
import { cn, Interval, WorkoutState, COLORS } from './lib/utils';
import { audioEngine } from './lib/audio';

// --- Components ---

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'solid' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
};

const Button = ({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) => {
  const variants = {
    primary: 'bg-white/10 text-white hover:bg-white/20 border border-white/10',
    secondary: 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-white/5',
    ghost: 'text-white/40 hover:text-white/80 hover:bg-white/5',
    accent: 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 shadow-lg shadow-accent/5',
    solid: 'bg-accent text-bg hover:bg-accent/90 shadow-2xl shadow-accent/40 border-none',
    white: 'bg-white text-bg hover:bg-white/90 shadow-xl border-none',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
  };

  const sizes = {
    xs: 'px-2 py-1 text-[10px] uppercase tracking-wider font-medium',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-8 py-5 text-lg font-black tracking-[0.2em]',
    icon: 'p-2',
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
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
  audioLibrary: { id: string, name: string }[];
}

const IntervalCard = ({ 
  interval, 
  onDelete, 
  onDuplicate,
  onUpdate,
  onOpenPlaylist,
  audioLibrary,
}: IntervalCardProps) => {
  const dragControls = useDragControls();
  const [showNotes, setShowNotes] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const mins = Math.floor(interval.duration / 60);
  const secs = interval.duration % 60;

  const isAnyMenuOpen = showNotes || showColorPicker || showActions;

  return (
    <Reorder.Item 
      value={interval}
      dragListener={false}
      dragControls={dragControls}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      style={{ zIndex: isAnyMenuOpen ? 50 : 1, position: 'relative' }}
      className={cn(
        "glass rounded-2xl flex flex-row group hover:bg-white/[0.02] border border-white/5 overflow-hidden",
        isAnyMenuOpen && "z-50"
      )}
    >
      {/* Full Height Drag Handle */}
      <div 
        onPointerDown={(e) => dragControls.start(e)}
        className="w-10 flex items-center justify-center cursor-grab active:cursor-grabbing text-white/10 hover:text-white/30 hover:bg-white/5 transition-all border-r border-white/5 shrink-0"
      >
        <GripVertical size={20} />
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pr-10">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Color Indicator & Picker */}
            <div className="relative">
              <button 
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-2 h-14 rounded-full shrink-0 shadow-lg transition-transform hover:scale-110 active:scale-95" 
                style={{ backgroundColor: interval.color, boxShadow: `0 0 15px ${interval.color}40` }}
                title="Change Color"
              />
              
              <AnimatePresence>
                {showColorPicker && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: -10 }}
                      className="absolute left-full ml-3 top-0 z-40 glass border border-white/10 rounded-xl p-2 grid grid-cols-4 gap-2 shadow-2xl min-w-[120px]"
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
                            interval.color === color ? "border-white" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Time Section - Integrated & Prominent */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={mins === 0 ? '' : mins.toString()}
                  placeholder="0"
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0);
                    onUpdate({ duration: val * 60 + secs });
                  }}
                  className="w-10 sm:w-12 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-right text-2xl sm:text-3xl font-mono font-black text-white tabular-nums selection:bg-accent/30"
                />
                <span className="text-[9px] sm:text-[10px] font-black text-white/60 uppercase tracking-widest">min</span>
              </div>
              <span className="text-xl sm:text-2xl font-mono text-white/10">:</span>
              <div className="flex items-center gap-1.5">
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={secs === 0 ? '' : secs.toString()}
                  placeholder="0"
                  onChange={(e) => {
                    let val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                    if (val > 59) val = 59;
                    if (val < 0) val = 0;
                    onUpdate({ duration: mins * 60 + val });
                  }}
                  className="w-10 sm:w-12 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-right text-2xl sm:text-3xl font-mono font-black text-white tabular-nums selection:bg-accent/30"
                />
                <span className="text-[9px] sm:text-[10px] font-black text-white/60 uppercase tracking-widest">sec</span>
              </div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-10 bg-white/10 shrink-0 hidden sm:block" />

          {/* Content Section */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <input 
              value={interval.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Interval Title"
              className="bg-transparent border-none p-0 font-bold text-base sm:text-lg text-white/90 focus:ring-0 focus:outline-none w-full placeholder:text-white/10 truncate"
            />
            
            <div className="flex items-center gap-4 text-[10px] font-mono text-white/30 uppercase tracking-widest">
              {/* Notes Button */}
              <div className="relative">
                <Button 
                  variant={interval.notes ? "accent" : "secondary"}
                  size="xs"
                  onClick={() => setShowNotes(!showNotes)}
                  title={interval.notes ? "View/Edit Notes" : "Add Notes"}
                  className="h-6 px-2 text-[9px]"
                >
                  <FileText size={10} />
                  Notes
                </Button>
                
                {showNotes && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNotes(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="absolute left-0 top-full mt-2 z-40 glass border border-white/10 rounded-xl p-3 w-64 shadow-2xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Interval Notes</span>
                        <button onClick={() => setShowNotes(false)} className="text-white/30 hover:text-white">
                          <X size={12} />
                        </button>
                      </div>
                      <textarea 
                        autoFocus
                        value={interval.notes || ''}
                        onChange={(e) => onUpdate({ notes: e.target.value })}
                        placeholder="Add notes for this interval..."
                        className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 resize-none placeholder:text-white/10 transition-all"
                      />
                    </motion.div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Music size={10} className="text-white/20" />
                <span>{(interval.playlist || []).length} Tracks</span>
              </div>
            </div>
          </div>

          {/* Actions Section - 3 Dot Menu (Absolute Positioned) */}
          <div className="absolute top-2 right-2 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowActions(!showActions)}
              className="w-8 h-8 text-white/40 hover:text-white"
            >
              <MoreVertical size={18} />
            </Button>

            <AnimatePresence>
              {showActions && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowActions(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10, x: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10, x: -10 }}
                    className="absolute right-0 top-full mt-2 z-40 glass border border-white/10 rounded-xl p-1 w-40 shadow-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        onDuplicate();
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left"
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
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Music size={12} className="text-white/30" />
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Playlist</span>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {/* Selected Songs (Reorderable) */}
            <Reorder.Group 
              axis="x" 
              values={interval.playlist || []} 
              onReorder={(newPlaylist) => onUpdate({ playlist: newPlaylist })}
              className="flex flex-wrap gap-1"
            >
              {(interval.playlist || []).map((track) => {
                const audio = audioLibrary.find(a => a.id === track.audioId);
                if (!audio) return null;
                return (
                  <Reorder.Item 
                    key={track.instanceId}
                    value={track}
                    transition={{ type: "spring", stiffness: 600, damping: 30 }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono group/song cursor-grab active:cursor-grabbing"
                    style={{ backgroundColor: `${interval.color}20`, color: interval.color, borderColor: `${interval.color}50` }}
                  >
                    <span className="truncate max-w-[80px]">{audio.name}</span>
                    <button 
                      onClick={() => {
                        const nextPlaylist = (interval.playlist || []).filter((t) => t.instanceId !== track.instanceId);
                        onUpdate({ playlist: nextPlaylist });
                      }}
                      className="hover:text-red-400 ml-1 opacity-0 group-hover/song:opacity-100 transition-opacity"
                      title="Remove Song"
                    >
                      <X size={10} />
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>

            {/* Add Song Control */}
            <div className="relative">
              <Button
                variant="secondary"
                size="xs"
                onClick={onOpenPlaylist}
                title="Edit Playlist"
              >
                <Plus size={10} /> Add Song
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
};

interface PlaylistDrawerProps {
  interval: Interval;
  audioLibrary: { id: string, name: string }[];
  onClose: () => void;
  onUpdate: (updates: Partial<Interval>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAudio: (id: string) => void;
}

const PlaylistDrawer = ({ 
  interval, 
  audioLibrary, 
  onClose, 
  onUpdate, 
  onFileUpload,
  onRemoveAudio 
}: PlaylistDrawerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        style={{ '--interval-color': interval.color } as React.CSSProperties}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md glass border-l border-white/10 z-[101] flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white">Edit Playlist</h2>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">
              Interval: <span style={{ color: interval.color }}>{interval.name || 'Untitled'}</span>
            </p>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Current Playlist */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Current Tracks</h3>
              <span className="text-[10px] font-mono text-white/30">{(interval.playlist || []).length} Total</span>
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
                  <p className="text-xs text-white/20 italic">No songs in playlist</p>
                </div>
              ) : (
                (interval.playlist || []).map((track) => {
                  const audio = audioLibrary.find(a => a.id === track.audioId);
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
                        <p className="text-xs font-bold text-white/80 truncate">{audio.name}</p>
                      </div>
                      <button 
                        onClick={() => {
                          const nextPlaylist = (interval.playlist || []).filter((t) => t.instanceId !== track.instanceId);
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
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Library</h3>
              <Button 
                variant="secondary" 
                size="xs" 
                onClick={() => fileInputRef.current?.click()}
                className="h-7 px-2 text-[9px]"
                style={{ backgroundColor: `${interval.color}20`, color: interval.color, borderColor: `${interval.color}40` }}
              >
                <Upload size={10} /> Upload New
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileUpload} 
                multiple 
                accept="audio/*" 
                className="hidden" 
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {audioLibrary.length === 0 ? (
                <p className="text-[10px] text-white/20 italic text-center py-4">No songs in library</p>
              ) : (
                audioLibrary.map(audio => (
                  <button
                    key={audio.id}
                    onClick={() => onUpdate({ 
                      playlist: [
                        ...(interval.playlist || []), 
                        { instanceId: Math.random().toString(36).substr(2, 9), audioId: audio.id }
                      ] 
                    })}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all group/lib"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${interval.color}20`, color: interval.color }}
                      >
                        <Music size={14} />
                      </div>
                      <span className="text-xs text-white/70 truncate">{audio.name}</span>
                    </div>
                    <Plus 
                      size={16} 
                      className="text-white/20 group-hover/lib:text-[var(--interval-color)] transition-colors" 
                    />
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-white/10">
          <Button 
            variant="solid" 
            className="w-full" 
            onClick={onClose}
            style={{ backgroundColor: interval.color, boxShadow: `0 10px 30px ${interval.color}40` }}
          >
            Done
          </Button>
        </div>
      </motion.div>
    </>
  );
};

export default function App() {
  const [workoutTitle, setWorkoutTitle] = useState('TempoTread Session');
  const [intervals, setIntervals] = useState<Interval[]>([
    { id: '1', name: 'Warm Up', duration: 10, notes: '', color: COLORS[1] },
    { id: '2', name: 'Sprint', duration: 10, notes: '', color: COLORS[3] },
    { id: '3', name: 'Recovery', duration: 10, notes: '', color: COLORS[2] },
  ]);
  
  const [state, setState] = useState<WorkoutState>('idle');
  const [countdownValue, setCountdownValue] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [currentSong, setCurrentSong] = useState<{ name: string, duration: number, currentTime: number, index: number, totalSongs: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [audioLibrary, setAudioLibrary] = useState<{ id: string, name: string }[]>([]);
  const [editingIntervalId, setEditingIntervalId] = useState<string | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<{ id: string, title: string, intervals: Interval[] }[]>([]);
  
  const timerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('tempotread_workouts');
    if (saved) {
      try {
        setSavedWorkouts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved workouts from localStorage');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tempotread_workouts', JSON.stringify(savedWorkouts));
  }, [savedWorkouts]);

  const saveCurrentWorkout = () => {
    const newWorkout = {
      id: Math.random().toString(36).substr(2, 9),
      title: workoutTitle,
      intervals: [...intervals]
    };
    setSavedWorkouts(prev => [newWorkout, ...prev]);
  };

  const loadWorkout = (workout: { id: string, title: string, intervals: Interval[] }) => {
    setWorkoutTitle(workout.title);
    setIntervals(workout.intervals);
    setShowSettings(false);
  };

  const deleteSavedWorkout = (id: string) => {
    setSavedWorkouts(prev => prev.filter(w => w.id !== id));
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
    if (state === 'finished') return '#44FF44';
    return currentInterval?.color || '#F27D26';
  }, [state, currentInterval]);
  const totalDuration = useMemo(() => intervals.reduce((acc, i) => acc + i.duration, 0), [intervals]);

  const startWorkout = () => {
    if (intervals.length === 0) return;
    
    if (state === 'idle' || state === 'finished') {
      if (state === 'finished') {
        resetWorkout();
      }
      setState('countdown');
      setCountdownValue(3);
      audioEngine.playCountdown(3);
    } else if (state === 'paused') {
      setState('running');
      audioEngine.resumePlaylist();
    }
  };

  const pauseWorkout = () => {
    setState('paused');
    audioEngine.pauseAll();
  };

  const resetWorkout = () => {
    setState('idle');
    setCurrentIndex(0);
    setTimeLeft(0);
    setTotalTimeElapsed(0);
    setCountdownValue(0);
    audioEngine.stopAll();
  };

  const previousInterval = () => {
    if (currentIndex > 0) {
      const prev = intervals[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      setTimeLeft(prev.duration);
      audioEngine.stopAll();
      audioEngine.playStart();
      if (prev.playlist?.length) {
        audioEngine.playPlaylist(prev.playlist, prev.duration);
      }
    }
  };

  const nextInterval = () => {
    if (currentIndex < intervals.length - 1) {
      const next = intervals[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      setTimeLeft(next.duration);
      audioEngine.stopAll();
      audioEngine.playStart();
      if (next.playlist?.length) {
        audioEngine.playPlaylist(next.playlist, next.duration);
      }
    } else {
      audioEngine.stopAll();
      setState('finished');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        for (let i = 0; i < files.length; i++) {
          await audioEngine.addCustomAudio(files[i]);
        }
        setAudioLibrary(audioEngine.getAudioLibrary());
      } catch (err) {
        console.error('Failed to load audio:', err);
      }
    }
  };

  const removeAudio = (id: string) => {
    audioEngine.removeAudio(id);
    setAudioLibrary(audioEngine.getAudioLibrary());
    // Clear audioId from intervals that used it
    setIntervals(intervals.map(i => ({
      ...i,
      playlist: i.playlist?.filter(track => track.audioId !== id)
    })));
  };

  useEffect(() => {
    let songPolling: number;
    if (state === 'running' || state === 'countdown') {
      songPolling = window.setInterval(() => {
        setCurrentSong(audioEngine.getCurrentSongInfo());
      }, 500);
    } else {
      setCurrentSong(null);
    }
    return () => clearInterval(songPolling);
  }, [state]);

  useEffect(() => {
    if (state === 'countdown') {
      const timer = setInterval(() => {
        setCountdownValue(prev => {
          const next = prev - 1;
          if (next > 0) {
            audioEngine.playCountdown(next);
            return next;
          } else {
            clearInterval(timer);
            setState('running');
            setCurrentIndex(0);
            setTimeLeft(intervals[0].duration);
            audioEngine.playStart();
            if (intervals[0].playlist?.length) {
              audioEngine.playPlaylist(intervals[0].playlist, intervals[0].duration);
            }
            return 0;
          }
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state, intervals]);

  useEffect(() => {
    if (state === 'running') {
      const tick = (now: number) => {
        if (!lastTickRef.current) lastTickRef.current = now;
        const delta = now - lastTickRef.current;

        if (delta >= 1000) {
          setTimeLeft((prev) => {
            const next = prev - 1;
            
            // Audio Cues
            if (next === Math.floor(currentInterval.duration / 2)) {
              audioEngine.playMiddle();
            }
            if (next <= 5 && next > 0) {
              audioEngine.playCountdown(next);
            }
            
            if (next <= 0) {
              if (currentIndex < intervals.length - 1) {
                audioEngine.playEnd();
                const nextInterval = intervals[currentIndex + 1];
                setTimeout(() => {
                  audioEngine.playStart();
                  if (nextInterval.playlist?.length) {
                    audioEngine.playPlaylist(nextInterval.playlist, nextInterval.duration);
                  }
                }, 500);
                setCurrentIndex(currentIndex + 1);
                return nextInterval.duration;
              } else {
                audioEngine.playEnd();
                audioEngine.stopAll();
                setState('finished');
                return 0;
              }
            }
            return next;
          });
          setTotalTimeElapsed(prev => prev + 1);
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
  }, [state, currentIndex, currentInterval, intervals]);

  const addInterval = () => {
    const newInterval: Interval = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Interval',
      duration: 60,
      notes: '',
      color: COLORS[intervals.length % COLORS.length]
    };
    setIntervals([...intervals, newInterval]);
  };

  const deleteInterval = (id: string) => {
    setIntervals(intervals.filter(i => i.id !== id));
  };

  const updateInterval = (id: string, updates: Partial<Interval>) => {
    setIntervals(intervals.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-bg text-white font-sans antialiased selection:bg-accent/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto flex flex-col p-4 md:p-8 lg:p-12 min-h-screen">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 lg:mb-16">
          <div className="flex-1 w-full max-w-md lg:max-w-4xl">
            <input 
              value={workoutTitle}
              onChange={(e) => setWorkoutTitle(e.target.value)}
              className="text-xl md:text-3xl lg:text-5xl font-black tracking-tighter text-accent bg-transparent border-none p-0 focus:ring-0 w-full uppercase truncate"
            />
          </div>
          <div className="flex items-center justify-between w-full sm:w-auto gap-6">
            <div className="sm:hidden text-left">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Total Duration</p>
              <p className="text-lg font-mono text-white/80">{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}</p>
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

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          {/* Left Column: Timeline */}
          <div 
            className={cn(
              "lg:col-span-7 space-y-6 sm:space-y-8",
              state !== 'idle' && "hidden lg:block opacity-20 pointer-events-none blur-[2px] transition-all duration-700"
            )}
          >
          <div className="flex justify-between items-end px-1">
            <h2 className="text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-white/40">Workout Timeline</h2>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Total Duration</p>
              <p className="text-xl font-mono text-white/80">{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}</p>
            </div>
          </div>

          <Reorder.Group 
            axis="y" 
            values={intervals} 
            onReorder={setIntervals}
            className="space-y-4 overflow-y-auto max-h-[70vh] lg:max-h-[calc(100vh-300px)] pr-2 custom-scrollbar"
          >
            <AnimatePresence mode="popLayout">
              {intervals.map((interval) => (
                <IntervalCard 
                  key={interval.id} 
                  interval={interval} 
                  onDelete={() => deleteInterval(interval.id)}
                  onDuplicate={() => duplicateInterval(intervals.indexOf(interval))}
                  onUpdate={(updates) => updateInterval(interval.id, updates)}
                  onOpenPlaylist={() => setEditingIntervalId(interval.id)}
                  audioLibrary={audioLibrary}
                />
              ))}
            </AnimatePresence>
            
            <Button 
              variant="secondary"
              onClick={addInterval}
              className="w-full py-8 border-2 border-dashed border-white/10 rounded-2xl flex-col gap-3 group mt-4"
            >
              <Plus size={24} className="group-hover:scale-110 transition-transform text-white/40" />
              <span className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-white/80">Add Interval</span>
            </Button>
          </Reorder.Group>
        </div>

        {/* Right Column: Active State / Controls */}
        <div className="lg:col-span-5 lg:sticky lg:top-12">
          {state === 'idle' ? (
            <div className="glass p-8 rounded-[2rem] flex flex-col items-center text-center gap-8">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Timer size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Ready to start?</h3>
                <p className="text-white/40 text-sm max-w-[240px] mx-auto">
                  Review your timeline and audio cues before beginning your session.
                </p>
              </div>
              <Button
                variant="solid"
                size="lg"
                onClick={startWorkout}
                className="w-full rounded-2xl"
              >
                <Play size={24} fill="currentColor" />
                START SESSION
              </Button>
            </div>
          ) : state === 'countdown' ? (
            <div className="glass p-8 lg:p-12 rounded-[2rem] flex flex-col justify-center items-center text-center min-h-[400px]">
              <motion.div
                key={countdownValue}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="text-[10rem] font-mono font-black leading-none"
                style={{ color: themeColor }}
              >
                {countdownValue}
              </motion.div>
              <p className="mt-8 text-white/40 font-mono uppercase tracking-[0.3em] text-sm">Get Ready</p>
              
              {currentSong && (
                <div className="mt-12 w-full max-w-xs">
                  <p className="text-[10px] font-mono text-white/40 uppercase mb-3 flex items-center justify-center gap-2">
                    <Music size={12} className="animate-pulse" style={{ color: themeColor }} /> Now Playing
                  </p>
                  <div className="glass bg-white/5 p-4 rounded-2xl">
                    <p className="text-sm font-bold truncate mb-2">{currentSong.name}</p>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-500" 
                        style={{ width: `${(currentSong.currentTime / currentSong.duration) * 100}%`, backgroundColor: themeColor }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass p-8 lg:p-12 rounded-[2rem] flex flex-col justify-center items-center text-center relative overflow-hidden">
              {/* Exit Button */}
              <button 
                onClick={resetWorkout}
                className="absolute top-6 right-6 p-2 text-white/20 hover:text-white/60 hover:bg-white/5 rounded-full transition-all z-20"
                title="Exit Workout"
              >
                <LogOut size={20} />
              </button>

              <div key={currentIndex} className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 flex items-center justify-center mb-8 sm:mb-12">
                {/* Progress Ring */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    key={`bg-${currentIndex}`}
                    cx="50"
                    cy="50"
                    r="45"
                    className="fill-none stroke-[4]"
                    style={{ stroke: `${themeColor}20` }}
                  />
                  <motion.circle
                    key={currentIndex}
                    cx="50"
                    cy="50"
                    r="45"
                    className="fill-none stroke-[4]"
                    animate={{ 
                      stroke: themeColor,
                      strokeDashoffset: (2 * Math.PI * 45) * (1 - timeLeft / currentInterval.duration) 
                    }}
                    transition={{ 
                      stroke: { duration: 0.5 },
                      strokeDashoffset: { duration: 1, ease: "linear" }
                    }}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 45}
                  />
                </svg>
                
                <div className="flex flex-col items-center z-10 px-4">
                  <p 
                    className="text-[10px] sm:text-sm font-mono uppercase tracking-[0.2em] mb-1 sm:mb-2 text-center"
                    style={{ color: themeColor }}
                  >
                    {state === 'finished' ? 'WORKOUT COMPLETE' : currentInterval.name}
                  </p>
                  <p 
                    className="text-5xl sm:text-7xl md:text-8xl font-mono font-black tabular-nums"
                    style={{ color: state === 'finished' ? themeColor : 'white' }}
                  >
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>

              {currentInterval.notes && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12 glass border p-4 rounded-2xl max-w-md w-full text-center"
                  style={{ backgroundColor: `${currentInterval.color}10`, borderColor: `${currentInterval.color}20` }}
                >
                  <div 
                    className="flex items-center justify-center gap-2 mb-2"
                    style={{ color: `${currentInterval.color}90` }}
                  >
                    <FileText size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Interval Notes</span>
                  </div>
                  <p className="text-xs text-white/70 italic leading-relaxed break-words">{currentInterval.notes}</p>
                </motion.div>
              )}

              <div className="w-full space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-4 rounded-2xl text-left">
                    <p className="text-[10px] font-mono text-white/40 uppercase mb-1 tracking-widest">Total Time</p>
                    <p className="text-xl font-mono">{Math.floor(totalTimeElapsed / 60)}:{(totalTimeElapsed % 60).toString().padStart(2, '0')}</p>
                  </div>
                  <div className="glass p-4 rounded-2xl text-left">
                    <p className="text-[10px] font-mono text-white/40 uppercase mb-1 tracking-widest">Next Up</p>
                    <p className="text-xl font-mono truncate">
                      {currentIndex < intervals.length - 1 ? intervals[currentIndex + 1].name : 'Finish'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center items-center gap-4 sm:gap-6">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={previousInterval}
                    disabled={currentIndex === 0 || state === 'finished'}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full disabled:opacity-20"
                    title="Previous Interval"
                  >
                    <SkipBack size={20} className="sm:w-6 sm:h-6" />
                  </Button>
                  <Button
                    variant="white"
                    size="icon"
                    onClick={() => {
                      if (state === 'finished') {
                        startWorkout();
                      } else {
                        state === 'running' ? pauseWorkout() : startWorkout();
                      }
                    }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
                    title={state === 'finished' ? 'Restart Workout' : state === 'running' ? 'Pause' : 'Resume'}
                  >
                    {state === 'finished' ? (
                      <RotateCcw size={28} className="sm:w-8 sm:h-8" />
                    ) : state === 'running' ? (
                      <Pause size={28} className="sm:w-8 sm:h-8" fill="currentColor" />
                    ) : (
                      <Play size={28} className="sm:w-8 sm:h-8 ml-1" fill="currentColor" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={nextInterval}
                    disabled={state === 'finished'}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full disabled:opacity-20"
                    title={currentIndex === intervals.length - 1 ? 'Finish Workout' : 'Skip Interval'}
                  >
                    {currentIndex === intervals.length - 1 ? (
                      <CheckCircle2 size={24} className="sm:w-7 sm:h-7" />
                    ) : (
                      <SkipForward size={24} className="sm:w-7 sm:h-7" />
                    )}
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-mono text-white/30 uppercase tracking-widest">
                    <span>Progress</span>
                    <span>{currentIndex + 1} / {intervals.length}</span>
                  </div>
                  <div className="flex w-full h-2 gap-1 rounded-full overflow-hidden">
                    {intervals.map((interval, index) => {
                      const isPast = index < currentIndex || state === 'finished';
                      const isActive = index === currentIndex && state !== 'finished';
                      return (
                        <div 
                          key={interval.id}
                          className="h-full transition-all duration-500"
                          style={{ 
                            width: `${(1 / intervals.length) * 100}%`,
                            backgroundColor: interval.color,
                            opacity: isPast ? 0.3 : isActive ? 1 : 0.1
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {currentSong && (
                  <div className="glass bg-white/5 p-6 rounded-2xl text-left">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <Music size={12} style={{ color: themeColor }} /> Now Playing
                      </p>
                      <span className="text-[10px] font-mono text-white/20">{currentSong.index + 1} / {currentSong.totalSongs}</span>
                    </div>
                    <p className="text-sm font-bold truncate mb-3">{currentSong.name}</p>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full transition-all duration-500" 
                        style={{ width: `${(currentSong.currentTime / currentSong.duration) * 100}%`, backgroundColor: themeColor }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-white/30">
                      <span>{Math.floor(currentSong.currentTime / 60)}:{(Math.floor(currentSong.currentTime % 60)).toString().padStart(2, '0')}</span>
                      <span>{Math.floor(currentSong.duration / 60)}:{(Math.floor(currentSong.duration % 60)).toString().padStart(2, '0')}</span>
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
            <div className="w-full max-w-2xl flex flex-col h-full max-h-[90vh] glass p-6 md:p-10 rounded-[2.5rem] neo-shadow relative">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-3 glass rounded-full text-white/60 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-10 overflow-y-auto pr-4 custom-scrollbar flex-1">
                <section>
                  <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Save size={14} /> Save Current Timeline
                  </h3>
                  <button 
                    onClick={saveCurrentWorkout}
                    className="w-full py-5 glass rounded-2xl flex items-center justify-center gap-3 text-accent hover:bg-accent/10 transition-all border border-accent/20"
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
                    <div className="space-y-3">
                      {savedWorkouts.map(workout => (
                        <div key={workout.id} className="glass p-5 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-colors">
                          <div className="flex-1 cursor-pointer" onClick={() => loadWorkout(workout)}>
                            <p className="font-bold text-lg">{workout.title}</p>
                            <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                              {workout.intervals.length} Intervals • {Math.floor(workout.intervals.reduce((acc, i) => acc + i.duration, 0) / 60)}m
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
                    <Music size={14} /> Audio Library
                  </h3>
                  <div className="glass p-8 rounded-2xl space-y-6">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="audio/*"
                      multiple
                      className="hidden"
                    />
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                      <Upload size={18} />
                      Upload New Audio
                    </button>

                    <div className="space-y-2">
                      {audioLibrary.length === 0 ? (
                        <p className="text-center text-[10px] text-white/20 py-6">No custom audio files uploaded.</p>
                      ) : (
                        audioLibrary.map(audio => (
                          <div key={audio.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-sm text-white/80 truncate pr-4">{audio.name}</span>
                            <button 
                              onClick={() => removeAudio(audio.id)}
                              className="text-white/30 hover:text-red-400 transition-colors"
                            >
                              <MinusCircle size={18} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Settings size={14} /> App Information
                  </h3>
                  <div className="glass p-8 rounded-2xl space-y-4">
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

              <div className="mt-10">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-5 bg-accent text-bg font-black rounded-2xl uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:scale-[1.02] transition-transform"
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
            interval={intervals.find(i => i.id === editingIntervalId)!}
            audioLibrary={audioLibrary}
            onClose={() => setEditingIntervalId(null)}
            onUpdate={(updates) => updateInterval(editingIntervalId, updates)}
            onFileUpload={handleFileUpload}
            onRemoveAudio={removeAudio}
          />
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
