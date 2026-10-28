import { audioEngine } from "../lib/audio";
import type { ColorGroup, PlaylistTrack } from "../lib/utils";
import { getGroupForInterval } from "../lib/utils";

type PlaylistPlaybackOptions = { startPaused?: boolean };

/**
 * Load the merged playlist for a color group. Empty groups clear playback
 * so the previous group's music cannot leak into a different color.
 */
export function applyGroupPlaylist(
  colorGroups: ColorGroup[],
  intervalColor: string,
  options?: PlaylistPlaybackOptions,
) {
  const group = getGroupForInterval(colorGroups, intervalColor);
  if (group && group.mergedPlaylist.length > 0) {
    audioEngine.playPlaylist(group.mergedPlaylist, group.totalDuration, options);
    return;
  }
  audioEngine.stopAll();
}

/**
 * Same-color intervals share a playlist (auto-advance and manual skip).
 * Different colors swap to the new group. While paused, an empty destination
 * keeps the current playlist paused so Now Playing does not disappear.
 */
export function syncPlaylistOnIntervalChange(
  colorGroups: ColorGroup[],
  fromColor: string,
  toColor: string,
  options?: PlaylistPlaybackOptions,
) {
  if (fromColor === toColor) return;
  if (options?.startPaused) {
    const group = getGroupForInterval(colorGroups, toColor);
    if (!group || group.mergedPlaylist.length === 0) return;
  }
  applyGroupPlaylist(colorGroups, toColor, options);
}

/** Resume the current group's playlist in place, or start it if the color changed while paused. */
export function resumeGroupPlaylist(
  colorGroups: ColorGroup[],
  intervalColor: string,
) {
  const group = getGroupForInterval(colorGroups, intervalColor);
  if (!group || group.mergedPlaylist.length === 0) {
    audioEngine.stopAll();
    return;
  }
  if (audioEngine.isPausedPlaylistFor(group.mergedPlaylist)) {
    audioEngine.resumePlaylist();
    return;
  }
  applyGroupPlaylist(colorGroups, intervalColor);
}

/**
 * Thin wrappers around {@link audioEngine} for workout flows — keeps call sites consistent.
 */
export function useWorkoutAudio() {
  return {
    engine: audioEngine,
    startPlaylistForGroup: applyGroupPlaylist,
    syncPlaylistOnIntervalChange,
    resumeGroupPlaylist,
    startPlaylistFromTracks: (
      playlist: PlaylistTrack[],
      durationSeconds: number,
      options?: PlaylistPlaybackOptions,
    ) => {
      if (playlist.length > 0) {
        audioEngine.playPlaylist(playlist, durationSeconds, options);
        return;
      }
      audioEngine.stopAll();
    },
  };
}
