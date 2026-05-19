// src/lib/firebaseSync.ts
import {
  doc, setDoc, getDoc, collection, getDocs, deleteDoc
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "firebase/storage";
import { db, storage } from "./firebase";
import type { Interval, PlaylistTrack } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedWorkout {
  id: string;
  title: string;
  intervals: Interval[];
}

export interface Settings {
  alarmVolume: number;
  alarmPreset: "digital" | "chime" | "bell" | "buzzer" | "custom";
  customAlarmName: string;
  customAlarmStoragePath: string | null; // path in Storage, not a URL
  halfwaySoundEnabled: boolean;
  musicMuted?: boolean;
}

export interface AudioLibraryEntry {
  id: string;
  name: string;
  storagePath: string;
  downloadURL: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function saveSettings(uid: string, settings: Settings) {
  await setDoc(doc(db, "users", uid, "settings", "main"), settings);
}

export async function loadSettings(uid: string): Promise<Settings | null> {
  const snap = await getDoc(doc(db, "users", uid, "settings", "main"));
  return snap.exists() ? (snap.data() as Settings) : null;
}

// ─── Custom Alarm Sound ────────────────────────────────────────────────────────

export async function uploadCustomAlarm(
  uid: string,
  file: File
): Promise<{ storagePath: string; downloadURL: string }> {
  const storagePath = `users/${uid}/alarms/custom_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return { storagePath, downloadURL };
}

export async function deleteCustomAlarm(storagePath: string) {
  await deleteObject(ref(storage, storagePath));
}

// ─── Saved Workouts Library ───────────────────────────────────────────────────

export async function saveWorkoutToLibrary(uid: string, workout: SavedWorkout): Promise<void> {
  await setDoc(doc(db, "users", uid, "savedWorkouts", workout.id), normalizeSavedWorkout(workout));
}

export async function loadSavedWorkouts(uid: string): Promise<SavedWorkout[]> {
  const snap = await getDocs(collection(db, "users", uid, "savedWorkouts"));
  return snap.docs.map((d) => normalizeSavedWorkout(d.data()));
}

export async function deleteSavedWorkoutFromLibrary(uid: string, workoutId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "savedWorkouts", workoutId));
}

function normalizePlaylist(playlist: unknown): PlaylistTrack[] {
  if (!Array.isArray(playlist)) return [];

  return playlist
    .map((track) => {
      const candidate = track as Partial<PlaylistTrack> | null | undefined;
      const audioId = typeof candidate?.audioId === "string" ? candidate.audioId.trim() : "";
      if (!audioId) return null;

      return {
        audioId,
        instanceId:
          typeof candidate.instanceId === "string" && candidate.instanceId.trim().length > 0
            ? candidate.instanceId
            : crypto.randomUUID(),
      };
    })
    .filter((track): track is PlaylistTrack => track !== null);
}

export function normalizeInterval(
  interval: Partial<Interval> | null | undefined,
  fallbackIndex = 0,
): Interval {
  const safeDuration = Number.isFinite(interval?.duration)
    ? Math.max(0, Number(interval?.duration))
    : 0;

  const normalized: Interval = {
    id:
      typeof interval?.id === "string" && interval.id.trim().length > 0
        ? interval.id
        : crypto.randomUUID(),
    name:
      typeof interval?.name === "string" && interval.name.trim().length > 0
        ? interval.name
        : `Interval ${fallbackIndex + 1}`,
    duration: safeDuration,
    color:
      typeof interval?.color === "string" && interval.color.trim().length > 0
        ? interval.color
        : "#F27D26",
  };

  if (typeof interval?.notes === "string") {
    normalized.notes = interval.notes;
  }

  const playlist = normalizePlaylist(interval?.playlist);
  if (playlist.length > 0) {
    normalized.playlist = playlist;
  }

  if (typeof interval?.halfwayAlert === "boolean") {
    normalized.halfwayAlert = interval.halfwayAlert;
  }

  return normalized;
}

export function normalizeWorkoutData(data: Partial<WorkoutData> | null | undefined): WorkoutData {
  return {
    workoutTitle:
      typeof data?.workoutTitle === "string" && data.workoutTitle.trim().length > 0
        ? data.workoutTitle.trim()
        : "TempoTread Session",
    intervals: Array.isArray(data?.intervals)
      ? data.intervals.map((interval, index) => normalizeInterval(interval, index))
      : [],
  };
}

export function normalizeSavedWorkout(
  workout: Partial<SavedWorkout> | null | undefined,
): SavedWorkout {
  const normalizedData = normalizeWorkoutData({
    workoutTitle: workout?.title,
    intervals: workout?.intervals,
  });

  return {
    id:
      typeof workout?.id === "string" && workout.id.trim().length > 0
        ? workout.id
        : crypto.randomUUID(),
    title: normalizedData.workoutTitle,
    intervals: normalizedData.intervals,
  };
}

// Helper to clean intervals (DRY)
function cleanInterval(interval: Interval) {
  const normalizedInterval = normalizeInterval(interval);

  return {
    id: normalizedInterval.id,
    name: normalizedInterval.name || "",
    duration: normalizedInterval.duration || 0,
    color: normalizedInterval.color || "#F27D26",
    ...(normalizedInterval.notes !== undefined && { notes: normalizedInterval.notes }),
    ...(normalizedInterval.playlist !== undefined
      ? { playlist: normalizedInterval.playlist }
      : { playlist: [] }),
    ...(normalizedInterval.halfwayAlert !== undefined && {
      halfwayAlert: normalizedInterval.halfwayAlert,
    }),
  };
}

const CURRENT_WORKOUT_ID = "current";

export interface WorkoutData {
  workoutTitle: string;
  intervals: Interval[];
}

export async function saveWorkout(uid: string, data: WorkoutData): Promise<void> {
  const cleanData: WorkoutData = {
    workoutTitle: data.workoutTitle?.trim() || "TempoTread Session",
    intervals: data.intervals.map(cleanInterval),
  };
  await setDoc(doc(db, "users", uid, "workouts", CURRENT_WORKOUT_ID), cleanData);
}

export async function saveNewWorkout(uid: string, data: WorkoutData): Promise<string> {
  const newId = crypto.randomUUID();
  const libraryWorkout: SavedWorkout = {
    id: newId,
    title: data.workoutTitle?.trim() || "TempoTread Session",
    intervals: data.intervals.map(cleanInterval),
  };
  await setDoc(doc(db, "users", uid, "savedWorkouts", newId), libraryWorkout);
  return newId;
}

export async function saveOrReplaceWorkout(
  uid: string,
  data: WorkoutData,
  existingWorkouts: SavedWorkout[]
): Promise<{ id: string; isNew: boolean }> {
  const titleToSave = data.workoutTitle?.trim().toLowerCase() || "tempotread session";

  const cleanedIntervals = data.intervals.map(cleanInterval);
  console.log("saveOrReplaceWorkout - Cleaned intervals being saved:");
  cleanedIntervals.forEach(i => {
    console.log(`  - ${i.name} (${i.color}): ${i.playlist?.length || 0} tracks`, i.playlist);
  });

  // Save to current workout document first
  const currentWorkoutData: WorkoutData = {
    workoutTitle: data.workoutTitle?.trim() || "TempoTread Session",
    intervals: cleanedIntervals,
  };
  await setDoc(doc(db, "users", uid, "workouts", CURRENT_WORKOUT_ID), currentWorkoutData);

  // Check if a workout with the same title (case-insensitive) exists
  const existingWorkout = existingWorkouts.find(
    (w) => w.title.trim().toLowerCase() === titleToSave
  );

  if (existingWorkout) {
    // Replace existing workout in library - keep same ID, update intervals
    const libraryWorkout: SavedWorkout = {
      id: existingWorkout.id,
      title: data.workoutTitle?.trim() || "TempoTread Session",
      intervals: cleanedIntervals,
    };
    await setDoc(doc(db, "users", uid, "savedWorkouts", existingWorkout.id), libraryWorkout);
    return { id: existingWorkout.id, isNew: false };
  } else {
    // Create new workout in library
    const newId = crypto.randomUUID();
    const libraryWorkout: SavedWorkout = {
      id: newId,
      title: data.workoutTitle?.trim() || "TempoTread Session",
      intervals: cleanedIntervals,
    };
    await setDoc(doc(db, "users", uid, "savedWorkouts", newId), libraryWorkout);
    return { id: newId, isNew: true };
  }
}

export async function loadWorkout(uid: string): Promise<WorkoutData | null> {
  const snap = await getDoc(doc(db, "users", uid, "workouts", CURRENT_WORKOUT_ID));
  if (snap.exists()) {
    const data = normalizeWorkoutData(snap.data() as Partial<WorkoutData>);
    console.log("loadWorkout - Raw data from Firebase:");
    data.intervals?.forEach(i => {
      console.log(`  - ${i.name} (${i.color}): ${i.playlist?.length || 0} tracks`, i.playlist);
    });
    return data;
  }
  return null;
}

// Legacy functions for backwards compatibility
export async function saveCurrentWorkoutState(uid: string, data: WorkoutData): Promise<void> {
  return saveWorkout(uid, data);
}

export async function loadCurrentWorkoutState(uid: string): Promise<WorkoutData | null> {
  return loadWorkout(uid);
}

// ─── Audio Library ────────────────────────────────────────────────────────────

export async function uploadAudioTrack(
  uid: string,
  file: File,
  id: string
): Promise<AudioLibraryEntry> {
  const storagePath = `users/${uid}/audio/${id}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);

  const entry: AudioLibraryEntry = { id, name: file.name, storagePath, downloadURL };
  await setDoc(doc(db, "users", uid, "audioLibrary", id), entry);
  return entry;
}

export async function deleteAudioTrack(uid: string, id: string, storagePath: string) {
  await deleteObject(ref(storage, storagePath));
  await deleteDoc(doc(db, "users", uid, "audioLibrary", id));
}

export async function loadAudioLibrary(uid: string): Promise<AudioLibraryEntry[]> {
  const snap = await getDocs(collection(db, "users", uid, "audioLibrary"));
  return snap.docs.map((d) => d.data() as AudioLibraryEntry);
}
