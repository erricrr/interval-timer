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
}

export type WorkoutState = 'idle' | 'countdown' | 'running' | 'paused' | 'finished';

export interface ColorGroup {
  startIndex: number;
  endIndex: number;
  color: string;
  totalDuration: number;
  mergedPlaylist: PlaylistTrack[];
}

export function buildColorGroups(intervals: Interval[]): ColorGroup[] {
  if (intervals.length === 0) return [];

  const groups: ColorGroup[] = [];
  let currentGroup: ColorGroup = {
    startIndex: 0,
    endIndex: 0,
    color: intervals[0].color,
    totalDuration: intervals[0].duration,
    mergedPlaylist: [...(intervals[0].playlist || [])],
  };

  for (let i = 1; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval.color === currentGroup.color) {
      // Same color - extend current group
      currentGroup.endIndex = i;
      currentGroup.totalDuration += interval.duration;
      // Merge playlists, avoiding duplicate audioIds
      const existingIds = new Set(currentGroup.mergedPlaylist.map(t => t.audioId));
      for (const track of interval.playlist || []) {
        if (!existingIds.has(track.audioId)) {
          currentGroup.mergedPlaylist.push(track);
        }
      }
    } else {
      // Different color - finalize current group and start new one
      groups.push(currentGroup);
      currentGroup = {
        startIndex: i,
        endIndex: i,
        color: interval.color,
        totalDuration: interval.duration,
        mergedPlaylist: [...(interval.playlist || [])],
      };
    }
  }
  // Push the last group
  groups.push(currentGroup);
  return groups;
}

export function getGroupForInterval(groups: ColorGroup[], intervalIndex: number): ColorGroup | undefined {
  return groups.find(g => g.startIndex <= intervalIndex && g.endIndex >= intervalIndex);
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
