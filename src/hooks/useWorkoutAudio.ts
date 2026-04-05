import { useCallback } from "react";
import { audioEngine } from "../lib/audio";
import type { ColorGroup, PlaylistTrack } from "../lib/utils";
import { getGroupForInterval } from "../lib/utils";

/**
 * Thin wrappers around {@link audioEngine} for workout flows — keeps call sites consistent.
 */
export function useWorkoutAudio() {
  const startPlaylistForGroup = useCallback(
    (colorGroups: ColorGroup[], intervalColor: string) => {
      const group = getGroupForInterval(colorGroups, intervalColor);
      if (group && group.mergedPlaylist.length > 0) {
        audioEngine.playPlaylist(group.mergedPlaylist, group.totalDuration);
      }
    },
    [],
  );

  const startPlaylistFromTracks = useCallback(
    (playlist: PlaylistTrack[], durationSeconds: number) => {
      if (playlist.length > 0) {
        audioEngine.playPlaylist(playlist, durationSeconds);
      }
    },
    [],
  );

  return {
    engine: audioEngine,
    startPlaylistForGroup,
    startPlaylistFromTracks,
  };
}
