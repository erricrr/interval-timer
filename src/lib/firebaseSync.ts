// src/lib/firebaseSync.ts
import {
  doc, setDoc, getDoc, collection, getDocs, deleteDoc
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "firebase/storage";
import { db, storage } from "./firebase";
import type { Interval } from "./utils";

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
  await setDoc(doc(db, "users", uid, "savedWorkouts", workout.id), workout);
}

export async function loadSavedWorkouts(uid: string): Promise<SavedWorkout[]> {
  const snap = await getDocs(collection(db, "users", uid, "savedWorkouts"));
  return snap.docs.map((d) => d.data() as SavedWorkout);
}

export async function deleteSavedWorkoutFromLibrary(uid: string, workoutId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "savedWorkouts", workoutId));
}

// Helper to clean intervals (DRY)
function cleanInterval(interval: Interval) {
  return {
    id: interval.id,
    name: interval.name || "",
    duration: interval.duration || 0,
    color: interval.color || "#F27D26",
    ...(interval.notes !== undefined && { notes: interval.notes }),
    ...(interval.playlist !== undefined ? { playlist: interval.playlist } : { playlist: [] }),
    ...(interval.halfwayAlert !== undefined && { halfwayAlert: interval.halfwayAlert }),
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
    const data = snap.data() as WorkoutData;
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
