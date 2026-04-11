import React from "react";
import { Music, SkipBack, SkipForward, VolumeX } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./Button";

export interface SongInfo {
  name: string;
  duration: number;
  currentTime: number;
  index: number;
  totalSongs: number;
}

interface NowPlayingPanelProps {
  song: SongInfo | null;
  themeColor: string;
  musicMuted: boolean;
  isMobileLandscape: boolean;
  showTransportControls: boolean;
  onSkipTrack?: (direction: "previous" | "next") => void;
  className?: string;
}

export function NowPlayingPanel({
  song,
  themeColor,
  musicMuted,
  isMobileLandscape,
  showTransportControls,
  onSkipTrack,
  className,
}: NowPlayingPanelProps) {
  if (!song) return null;

  const canControlPlayback = showTransportControls && typeof onSkipTrack === "function";
  const progressWidth = song.duration > 0 ? (song.currentTime / song.duration) * 100 : 0;

  return (
    <div
      className={cn(
        "w-full grid items-center grid-cols-[auto_minmax(0,1fr)_auto] gap-2",
        isMobileLandscape && "gap-1.5",
        className,
      )}
    >
      {canControlPlayback ? (
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onSkipTrack("previous")}
          className={cn(
            "w-10 h-10 rounded-full shrink-0",
            isMobileLandscape && "w-8 h-8",
          )}
          title="Previous Track"
        >
          <SkipBack size={isMobileLandscape ? 16 : 18} />
        </Button>
      ) : (
        <div
          className={cn(
            "w-10 h-10 shrink-0 opacity-0 pointer-events-none",
            isMobileLandscape && "w-8 h-8",
          )}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "glass bg-text-subtle/5 p-4 rounded-2xl text-left min-w-0",
          isMobileLandscape && "p-2.5",
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <p
            className={cn(
              "text-[10px] font-mono text-text-subtle/70 uppercase tracking-wider flex items-center gap-1.5",
              isMobileLandscape && "text-[9px] gap-1",
            )}
          >
            {musicMuted ? (
              <>
                <VolumeX size={11} className="text-text-subtle/50" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Music size={11} style={{ color: themeColor }} />
                <span>Now Playing</span>
              </>
            )}
          </p>
          <span
            className={cn(
              "text-[10px] font-mono text-text-subtle/30",
              isMobileLandscape && "text-[9px]",
            )}
          >
            {song.index + 1} / {song.totalSongs}
          </span>
        </div>
        <p
          className={cn(
            "text-sm font-bold truncate mb-2",
            isMobileLandscape && "text-xs mb-1",
          )}
        >
          {song.name}
        </p>
        <div
          className={cn(
            "w-full h-1.5 bg-text-subtle/10 rounded-full overflow-hidden mb-1",
            isMobileLandscape && "h-1 mb-0.5",
          )}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressWidth}%`,
              backgroundColor: themeColor,
            }}
          />
        </div>
        <div
          className={cn(
            "flex justify-between text-[10px] font-mono text-text-subtle/40",
            isMobileLandscape && "text-[9px]",
          )}
        >
          <span>
            {Math.floor(song.currentTime / 60)}:
            {Math.floor(song.currentTime % 60)
              .toString()
              .padStart(2, "0")}
          </span>
          <span>
            {Math.floor(song.duration / 60)}:
            {Math.floor(song.duration % 60)
              .toString()
              .padStart(2, "0")}
          </span>
        </div>
      </div>

      {canControlPlayback ? (
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onSkipTrack("next")}
          className={cn(
            "w-10 h-10 rounded-full shrink-0",
            isMobileLandscape && "w-8 h-8",
          )}
          title="Next Track"
        >
          <SkipForward size={isMobileLandscape ? 16 : 18} />
        </Button>
      ) : (
        <div
          className={cn(
            "w-10 h-10 shrink-0 opacity-0 pointer-events-none",
            isMobileLandscape && "w-8 h-8",
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
