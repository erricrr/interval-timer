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
  workoutTitle: string;
  alarmVolume: number;
  alarmPreset: "digital" | "chime" | "bell" | "buzzer" | "custom";
  customAlarmName: string;
  customAlarmStoragePath: string | null; // path in Storage, not a URL
  halfwaySoundEnabled: boolean;
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

// ─── Workout Timeline ─────────────────────────────────────────────────────────

export async function saveWorkout(uid: string, intervals: Interval[]) {
  await setDoc(doc(db, "users", uid, "workouts", "current"), { intervals });
}

export async function loadWorkout(uid: string): Promise<Interval[] | null> {
  const snap = await getDoc(doc(db, "users", uid, "workouts", "current"));
  return snap.exists() ? (snap.data().intervals as Interval[]) : null;
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
