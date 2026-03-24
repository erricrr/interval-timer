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

export const COLORS = [
  '#F27D26', // Orange
  '#44FF44', // Green
  '#4444FF', // Blue
  '#FF4444', // Red
  '#FFFF44', // Yellow
  '#FF44FF', // Pink
  '#00FFFF', // Cyan
  '#FF8800', // Amber
  '#88FF00', // Lime
  '#00FF88', // Spring Green
  '#0088FF', // Azure
  '#8800FF', // Violet
];
