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

export interface ColorGroup {
  color: string;
  indices: number[]; // All interval indices with this color
  totalDuration: number;
  mergedPlaylist: PlaylistTrack[];
}

export function buildColorGroups(intervals: Interval[]): ColorGroup[] {
  if (intervals.length === 0) return [];

  // Aggregate by color across all intervals
  const colorMap = new Map<string, ColorGroup>();

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const existing = colorMap.get(interval.color);

    if (existing) {
      existing.indices.push(i);
      existing.totalDuration += interval.duration;
      // Merge playlists, avoiding duplicate audioIds
      const existingIds = new Set(existing.mergedPlaylist.map(t => t.audioId));
      for (const track of interval.playlist || []) {
        if (!existingIds.has(track.audioId)) {
          existing.mergedPlaylist.push(track);
          existingIds.add(track.audioId);
        }
      }
    } else {
      colorMap.set(interval.color, {
        color: interval.color,
        indices: [i],
        totalDuration: interval.duration,
        mergedPlaylist: [...(interval.playlist || [])],
      });
    }
  }

  return Array.from(colorMap.values());
}

export function getGroupForInterval(groups: ColorGroup[], intervalColor: string): ColorGroup | undefined {
  return groups.find(g => g.color === intervalColor);
}

export const COLORS = [
  '#8b7aa8', // Muted Purple
  '#c9b8a0', // Warm Beige
  '#6a8a9a', // Steel Blue
  '#9a7a7a', // Dusty Rose
  '#7a9a8a', // Sage Green
  '#8a9a9a', // Blue Grey
  '#a0a080', // Olive
  '#8a7a8a', // Mauve
  '#6a7a9a', // Slate Blue
  '#9a8a7a', // Brown
  '#7a8a6a', // Moss Green
  '#8a6a7a', // Berry
  '#6a9a9a', // Teal
  '#9a8a8a', // Dusty Pink
  '#7a6a8a', // Plum
];
