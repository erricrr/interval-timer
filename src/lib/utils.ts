import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PlaylistTrack {
  instanceId: string;
  audioId: string;
}

export interface Interval {
  id: string;
  name: string;
  duration: number; // in seconds
  notes?: string;
  color: string;
  playlist?: PlaylistTrack[];
  halfwayAlert?: boolean;
}

export type WorkoutState = 'idle' | 'countdown' | 'running' | 'paused' | 'finished';

export function getTotalDuration(intervals: Pick<Interval, "duration">[]): number {
  return intervals.reduce((acc, interval) => acc + interval.duration, 0);
}

/** Remaining workout time from the current interval's clock plus every interval after it. */
export function getRemainingDuration(
  intervals: Pick<Interval, "duration">[],
  currentIndex: number,
  timeLeft: number,
): number {
  return Math.max(0, timeLeft) + getTotalDuration(intervals.slice(currentIndex + 1));
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getWorkoutDurationReadout(
  state: WorkoutState,
  totalDuration: number,
  remainingSeconds: number,
): { label: "Remaining" | "Total Duration"; seconds: number } {
  if (state === "running" || state === "paused") {
    return { label: "Remaining", seconds: remainingSeconds };
  }
  return { label: "Total Duration", seconds: totalDuration };
}

export interface ColorGroup {
  color: string;
  indices: number[]; // All interval indices with this color
  totalDuration: number;
  mergedPlaylist: PlaylistTrack[];
}

export function buildColorGroups(
  intervals: Interval[],
  audioLibrary: { id: string; name: string }[] = []
): ColorGroup[] {
  if (intervals.length === 0) return [];

  // Only filter by audio library if it's actually loaded
  // If audioLibrary is empty, don't filter (to avoid filtering out valid tracks during initial load)
  const shouldFilter = audioLibrary.length > 0;
  const validAudioIds = new Set(audioLibrary.map(a => a.id));

  // Aggregate by color across all intervals
  const colorMap = new Map<string, { indices: number[]; totalDuration: number; tracks: PlaylistTrack[] }>();

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const existing = colorMap.get(interval.color);

    // Filter valid tracks for this interval
    const validTracks = shouldFilter
      ? (interval.playlist || []).filter(track => validAudioIds.has(track.audioId))
      : [...(interval.playlist || [])];

    if (existing) {
      existing.indices.push(i);
      existing.totalDuration += interval.duration;
      existing.tracks.push(...validTracks);
    } else {
      colorMap.set(interval.color, {
        indices: [i],
        totalDuration: interval.duration,
        tracks: validTracks,
      });
    }
  }

  // Build final ColorGroup array with fresh objects
  return Array.from(colorMap.entries()).map(([color, data]) => ({
    color,
    indices: data.indices,
    totalDuration: data.totalDuration,
    mergedPlaylist: data.tracks,
  }));
}

export function getGroupForInterval(groups: ColorGroup[], intervalColor: string): ColorGroup | undefined {
  return groups.find(g => g.color === intervalColor);
}

export function getValidTracks(
  tracks: PlaylistTrack[],
  audioLibrary: { id: string; name: string }[]
): PlaylistTrack[] {
  const validAudioIds = new Set(audioLibrary.map(a => a.id));
  return tracks.filter(track => validAudioIds.has(track.audioId));
}

export const COLORS = [
  '#f27d26', // Orange (Primary)
  '#ff6b35', // Coral Orange
  '#ffa500', // Bright Orange
  '#ff4757', // Red
  '#ff6348', // Tomato Red
  '#ee5a6f', // Pink Red
  '#feca57', // Yellow
  '#ffd93d', // Golden Yellow
  '#6c5ce7', // Purple
  '#a29bfe', // Light Purple
  '#00b894', // Emerald Green
  '#26de81', // Mint Green
  '#45aaf2', // Sky Blue
  '#5f27cd', // Deep Purple
  '#fd79a8', // Pink
];
