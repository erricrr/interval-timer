/**
 * Audio Engine for TempoTread
 * - Alarms: Web Audio API (oscillators / short decoded custom alarm buffer)
 * - Playlist music: HTMLAudioElement native output + volume (streams; no full PCM). Uses
 *   crossOrigin=anonymous so Firebase Storage URLs load with CORS; avoids MediaElementSource
 *   (which silences cross-origin audio without CORS in the Web Audio graph). Beeps → Web Audio.
 */

import { PlaylistTrack } from "./utils";

/** Trim long custom alarm clips to avoid large buffers on mobile */
const CUSTOM_ALARM_MAX_SECONDS = 30;

/** Tiny WAV — play+pause in a tap handler unlocks iOS for later play() after countdown */
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";

/** Relative level vs beeps (matches previous musicGain 0.5 into master) */
const MUSIC_VOLUME = 0.5;

type TrackEntry = {
  name: string;
  url: string;
  duration: number;
  revokeOnRemove: boolean;
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private trackEntries: Map<string, TrackEntry> = new Map();

  /** Single element for all playlist — routed to device speakers via .volume (not MediaElementSource) */
  private playlistAudio: HTMLAudioElement | null = null;

  /** iOS: HTMLAudio unlock requires play() during user gesture; silent clip primes delayed playback */
  private playbackPrimed = false;

  private playlistState: {
    playlist: PlaylistTrack[];
    intervalDuration: number;
    currentIndex: number;
    currentOffset: number;
    isPaused: boolean;
    shouldLoop: boolean;
    // Group tracking
    currentGroupIndex: number;
    groupStartTime: number;
  } | null = null;

  // Beeps only — music uses HTMLAudioElement.volume + crossOrigin for remote URLs
  private beepsGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  // Alarm settings
  private alarmVolume: number = 0.5;
  private alarmPreset: "digital" | "chime" | "bell" | "buzzer" | "custom" = "digital";
  private customAlarmBuffer: AudioBuffer | null = null;
  private customAlarmName: string = "";

  // Music mute state
  private musicMuted: boolean = false;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      this.masterGain = this.ctx.createGain();
      this.beepsGain = this.ctx.createGain();

      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.beepsGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.beepsGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private applyPlaylistOutputState() {
    if (!this.playlistAudio) return;
    this.playlistAudio.muted = this.musicMuted;
    this.playlistAudio.volume = this.musicMuted ? 0 : MUSIC_VOLUME;
  }

  private syncPlaylistVolume() {
    this.applyPlaylistOutputState();
  }

  private getActivePlaylistElement(): HTMLAudioElement {
    this.ensurePlaylistAudio();
    return this.playlistAudio!;
  }

  private isPrimingOrEmptySrc(src: string): boolean {
    return !src || src === SILENT_WAV_DATA_URI;
  }

  private isTrackLoadedOnElement(trackAudioId: string, entryUrl: string): boolean {
    const el = this.playlistAudio;
    if (!el || this.currentPlaylistTrackId !== trackAudioId) return false;
    const src = el.currentSrc || el.src;
    return !this.isPrimingOrEmptySrc(src) && src === entryUrl;
  }

  private setPlaylistTrackSource(
    trackAudioId: string,
    url: string,
    onLoaded?: () => void,
  ): HTMLAudioElement {
    const el = this.getActivePlaylistElement();
    this.currentPlaylistTrackId = trackAudioId;
    el.src = url;
    this.applyPlaylistOutputState();
    if (onLoaded) {
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        onLoaded();
      } else {
        el.addEventListener("loadedmetadata", onLoaded, { once: true });
      }
    }
    el.load();
    return el;
  }

  /** Seek (optional) then play; retries immediately if media is ready, otherwise on canplay. */
  private attemptMediaPlay(el: HTMLAudioElement, seekTo?: number): void {
    if (seekTo !== undefined && Number.isFinite(seekTo) && seekTo >= 0) {
      try {
        el.currentTime = seekTo;
      } catch {
        /* not seekable yet — play() retry may still succeed */
      }
    }

    const promise = el.play();
    if (promise === undefined) return;

    void promise.catch(() => {
      if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        void el.play().catch(() => {});
        return;
      }
      const retry = () => {
        el.removeEventListener("canplay", retry);
        void el.play().catch(() => {});
      };
      el.addEventListener("canplay", retry, { once: true });
    });
  }

  /** Load or resume the current playlist track at `offset`. */
  private playTrackAtOffset(trackAudioId: string, entryUrl: string, offset: number): void {
    const el = this.getActivePlaylistElement();
    el.onended = this.handlePlaylistEnded;
    this.applyPlaylistOutputState();

    if (this.isTrackLoadedOnElement(trackAudioId, entryUrl)) {
      this.attemptMediaPlay(el, offset);
      return;
    }

    this.setPlaylistTrackSource(trackAudioId, entryUrl, () =>
      this.attemptMediaPlay(el, offset),
    );
  }

  /** Call synchronously from Start tap — required for iOS to allow play() after countdown */
  primePlaybackFromUserGesture(): void {
    this.init();
    void this.ctx?.resume();
    this.ensurePlaylistAudio();
    this.syncPlaylistVolume();

    if (this.playbackPrimed) return;

    const el = this.playlistAudio!;
    el.src = SILENT_WAV_DATA_URI;
    try {
      el.load();
    } catch {
      /* ignore */
    }
    const p = el.play();
    if (p !== undefined) {
      void p
        .then(() => {
          el.pause();
          el.removeAttribute("src");
          try {
            el.load();
          } catch {
            /* ignore */
          }
          this.playbackPrimed = true;
        })
        .catch(() => {
          /* next tap can retry */
        });
    } else {
      this.playbackPrimed = true;
    }
  }

  private ensurePlaylistAudio() {
    if (!this.playlistAudio) {
      this.playlistAudio = new Audio();
      // Before any src — required for Firebase Storage / cross-origin HTTPS URLs (CORS)
      this.playlistAudio.crossOrigin = "anonymous";
      this.playlistAudio.preload = "auto";
      this.syncPlaylistVolume();
    }
  }

  private probeAudioDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.crossOrigin = "anonymous";
      const finish = (d: number) => {
        audio.removeAttribute("src");
        audio.load();
        resolve(Number.isFinite(d) && d > 0 ? d : 0);
      };
      audio.addEventListener("loadedmetadata", () => finish(audio.duration));
      audio.addEventListener("error", () => finish(0));
      audio.src = url;
    });
  }

  async addCustomAudio(file: File): Promise<string> {
    this.init();
    const id = Math.random().toString(36).substr(2, 9);
    const url = URL.createObjectURL(file);
    const duration = await this.probeAudioDuration(url);
    this.trackEntries.set(id, {
      name: file.name,
      url,
      duration,
      revokeOnRemove: true,
    });
    return id;
  }

  async probeFileDuration(file: File): Promise<number> {
    const url = URL.createObjectURL(file);
    try {
      return await this.probeAudioDuration(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async addAudioFromURL(
    id: string,
    name: string,
    url: string,
    knownDuration?: number,
    options?: { revokeOnRemove?: boolean },
  ): Promise<void> {
    const duration =
      knownDuration !== undefined && knownDuration > 0
        ? knownDuration
        : await this.probeAudioDuration(url);
    this.trackEntries.set(id, {
      name,
      url,
      duration,
      revokeOnRemove: options?.revokeOnRemove ?? false,
    });
  }

  clearLibrary() {
    this.stopAll();
    for (const [id, entry] of this.trackEntries.entries()) {
      if (entry.revokeOnRemove) {
        try {
          URL.revokeObjectURL(entry.url);
        } catch {
          /* ignore */
        }
      }
      this.trackEntries.delete(id);
    }
  }

  getAudioLibrary() {
    return Array.from(this.trackEntries.entries()).map(([id, data]) => ({
      id,
      name: data.name,
    }));
  }

  removeAudio(id: string) {
    const entry = this.trackEntries.get(id);
    if (entry?.revokeOnRemove) {
      try {
        URL.revokeObjectURL(entry.url);
      } catch {
        /* ignore */
      }
    }
    this.trackEntries.delete(id);
  }

  // Alarm settings methods
  setAlarmVolume(volume: number) {
    this.alarmVolume = Math.max(0, Math.min(1, volume));
  }

  getAlarmVolume(): number {
    return this.alarmVolume;
  }

  setAlarmPreset(preset: "digital" | "chime" | "bell" | "buzzer" | "custom") {
    this.alarmPreset = preset;
  }

  getAlarmPreset(): string {
    return this.alarmPreset;
  }

  private trimAudioBuffer(buffer: AudioBuffer): AudioBuffer {
    if (!this.ctx) return buffer;
    if (buffer.duration <= CUSTOM_ALARM_MAX_SECONDS) return buffer;
    const frames = Math.floor(
      CUSTOM_ALARM_MAX_SECONDS * buffer.sampleRate,
    );
    const out = this.ctx.createBuffer(
      buffer.numberOfChannels,
      frames,
      buffer.sampleRate,
    );
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      out.copyToChannel(data.subarray(0, frames), c);
    }
    return out;
  }

  async setCustomAlarmFile(file: File): Promise<void> {
    this.init();
    if (!this.ctx) throw new Error("Audio context not initialized");

    const arrayBuffer = await file.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(arrayBuffer);
    this.customAlarmBuffer = this.trimAudioBuffer(decoded);
    this.customAlarmName = file.name;
    this.alarmPreset = "custom";
  }

  getCustomAlarmName(): string {
    return this.customAlarmName;
  }

  clearCustomAlarm() {
    this.customAlarmBuffer = null;
    this.customAlarmName = "";
    if (this.alarmPreset === "custom") {
      this.alarmPreset = "digital";
    }
  }

  getAlarmSettings() {
    return {
      volume: this.alarmVolume,
      preset: this.alarmPreset,
      customAlarmName: this.customAlarmName,
    };
  }

  setAlarmSettings(settings: { volume?: number; preset?: typeof this.alarmPreset; customAlarmName?: string }) {
    if (settings.volume !== undefined) {
      this.alarmVolume = Math.max(0, Math.min(1, settings.volume));
    }
    if (settings.preset !== undefined) {
      this.alarmPreset = settings.preset;
    }
    if (settings.customAlarmName !== undefined) {
      this.customAlarmName = settings.customAlarmName;
    }
  }

  setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    this.syncPlaylistVolume();
  }

  isMusicMuted(): boolean {
    return this.musicMuted;
  }

  /** Call after user gesture or on visibility — mobile suspends AudioContext aggressively */
  resumeAudioContext(): Promise<void> {
    this.init();
    if (!this.ctx) return Promise.resolve();
    if (this.ctx.state === "suspended") {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  stopAll() {
    if (this.playlistAudio) {
      try {
        this.playlistAudio.onended = null;
        this.playlistAudio.pause();
        this.playlistAudio.removeAttribute("src");
        this.playlistAudio.load();
      } catch {
        /* ignore */
      }
    }
    this.currentPlaylistTrackId = null;
    this.playlistState = null;
  }

  pauseAll() {
    if (!this.playlistState || this.playlistState.isPaused) return;

    this.playlistState.isPaused = true;

    if (this.playlistAudio) {
      this.playlistState.currentOffset = this.playlistAudio.currentTime;
      this.playlistAudio.pause();
    }
  }

  private getCurrentPlaylistTrack(): PlaylistTrack | null {
    if (!this.playlistState) return null;
    const { playlist, currentIndex } = this.playlistState;
    if (currentIndex < 0 || currentIndex >= playlist.length) return null;
    return playlist[currentIndex] ?? null;
  }

  resumePlaylist() {
    if (!this.playlistState || !this.playlistState.isPaused) return;

    const track = this.getCurrentPlaylistTrack();
    if (!track) return;

    const entry = this.trackEntries.get(track.audioId);
    if (!entry?.url) return;

    this.playlistState.isPaused = false;
    this.playTrackAtOffset(track.audioId, entry.url, this.playlistState.currentOffset);
  }

  /** Which track id is loaded on the media element (avoid redundant src sets). */
  private currentPlaylistTrackId: string | null = null;

  private handlePlaylistEnded = () => {
    if (!this.playlistState || this.playlistState.isPaused) return;
    this.playlistState.currentOffset = 0;
    this.onPlaylistTrackEnded();
  };

  private playNextInPlaylist() {
    if (!this.playlistState || this.playlistState.isPaused) return;

    const track = this.getCurrentPlaylistTrack();
    if (!track) return;

    const entry = this.trackEntries.get(track.audioId);

    if (!entry?.url) {
      this.onPlaylistTrackEnded();
      return;
    }

    this.playTrackAtOffset(track.audioId, entry.url, this.playlistState.currentOffset);
  }

  private jumpPlaylistBy(step: number): boolean {
    if (!this.playlistState) return false;
    const playlistLength = this.playlistState.playlist.length;
    if (playlistLength === 0) return false;

    const normalizedIndex =
      (this.playlistState.currentIndex + step + playlistLength) % playlistLength;
    this.playlistState.currentIndex = normalizedIndex;
    this.playlistState.currentOffset = 0;
    if (this.playlistState.isPaused) {
      // Keep paused state intact: swap loaded track without starting playback.
      const track = this.getCurrentPlaylistTrack();
      if (!track) return true;
      const entry = this.trackEntries.get(track.audioId);
      if (!entry?.url) return true;
      this.setPlaylistTrackSource(track.audioId, entry.url);
      return true;
    }
    this.playNextInPlaylist();
    return true;
  }

  skipToNextTrack(): boolean {
    return this.jumpPlaylistBy(1);
  }

  skipToPreviousTrack(): boolean {
    return this.jumpPlaylistBy(-1);
  }

  private playlistTotalDuration(playlist: PlaylistTrack[]): number {
    return playlist.reduce((acc, t) => {
      const d = this.trackEntries.get(t.audioId)?.duration ?? 0;
      return acc + d;
    }, 0);
  }

  private onPlaylistTrackEnded() {
    if (!this.playlistState || this.playlistState.isPaused) return;

    this.playlistState.currentIndex++;
    this.playlistState.currentOffset = 0;

    if (this.playlistState.currentIndex >= this.playlistState.playlist.length) {
      if (this.playlistState.shouldLoop) {
        this.playlistState.currentIndex = 0;
        this.playNextInPlaylist();
      }
    } else {
      this.playNextInPlaylist();
    }
  }

  // Alarm sound methods with preset support
  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    volume: number,
  ) {
    this.init();
    if (!this.ctx || !this.beepsGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;

    // Pre-schedule slightly ahead for smoother playback
    const when = this.ctx.currentTime + 0.01;
    osc.frequency.setValueAtTime(freq, when);

    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + duration,
    );

    osc.connect(gain);
    // Route through beepsGain for clean mixing with music
    gain.connect(this.beepsGain);

    osc.start(when);
    osc.stop(when + duration);
  }

  private playDigitalBeep(freq: number, duration: number, volume: number) {
    this.playTone(freq, "square", duration, volume);
  }

  private playChime(freq: number, duration: number, volume: number) {
    this.init();
    if (!this.ctx || !this.beepsGain) return;

    // Pre-schedule slightly ahead for smoother playback
    const when = this.ctx.currentTime + 0.01;

    // Create a bell-like sound with multiple harmonics
    const harmonics = [1, 2, 3, 4.2];
    harmonics.forEach((harmonic, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * harmonic, when);

      const harmonicVolume = volume * Math.pow(0.5, i);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(harmonicVolume, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        when + duration * (1 + i * 0.3),
      );

      osc.connect(gain);
      // Route through beepsGain for clean mixing with music
      gain.connect(this.beepsGain!);

      osc.start(when);
      osc.stop(when + duration * (1 + i * 0.3));
    });
  }

  private playBell(freq: number, duration: number, volume: number) {
    this.init();
    if (!this.ctx || !this.beepsGain) return;

    // Pre-schedule slightly ahead for smoother playback
    const when = this.ctx.currentTime + 0.01;

    // Bell sound with strong attack and long decay
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, when);

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + duration * 1.5,
    );

    osc.connect(gain);
    // Route through beepsGain for clean mixing with music
    gain.connect(this.beepsGain);

    osc.start(when);
    osc.stop(when + duration * 1.5);
  }

  private playBuzzer(freq: number, duration: number, volume: number) {
    this.init();
    if (!this.ctx || !this.beepsGain) return;

    // Pre-schedule slightly ahead for smoother playback
    const when = this.ctx.currentTime + 0.01;

    // Buzzer with modulation
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, when);

    lfo.type = "square";
    lfo.frequency.setValueAtTime(20, when);
    lfoGain.gain.setValueAtTime(freq * 0.1, when);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + duration,
    );

    osc.connect(gain);
    // Route through beepsGain for clean mixing with music
    gain.connect(this.beepsGain);

    lfo.start(when);
    osc.start(when);
    osc.stop(when + duration);
    lfo.stop(when + duration);
  }

  private playAlarmSound(freq: number, duration: number, isDouble: boolean = false) {
    const volume = this.alarmVolume;

    if (this.alarmPreset === "custom" && this.customAlarmBuffer) {
      this.playCustomAlarm();
      return;
    }

    switch (this.alarmPreset) {
      case "digital":
        this.playDigitalBeep(freq, duration, volume);
        if (isDouble) {
          setTimeout(() => this.playDigitalBeep(freq * 0.8, duration, volume), 150);
        }
        break;
      case "chime":
        this.playChime(freq, duration, volume);
        if (isDouble) {
          setTimeout(() => this.playChime(freq * 0.8, duration * 0.8, volume), 200);
        }
        break;
      case "bell":
        this.playBell(freq, duration, volume);
        if (isDouble) {
          setTimeout(() => this.playBell(freq * 0.75, duration, volume), 300);
        }
        break;
      case "buzzer":
        this.playBuzzer(freq, duration, volume);
        if (isDouble) {
          setTimeout(() => this.playBuzzer(freq * 0.7, duration, volume), 200);
        }
        break;
      default:
        this.playDigitalBeep(freq, duration, volume);
    }
  }

  private playCustomAlarm() {
    if (!this.ctx || !this.customAlarmBuffer || !this.beepsGain) return;

    // Pre-schedule slightly ahead for smoother playback
    const when = this.ctx.currentTime + 0.01;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();

    source.buffer = this.customAlarmBuffer;
    gain.gain.setValueAtTime(this.alarmVolume, when);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + this.customAlarmBuffer.duration,
    );

    source.connect(gain);
    // Route through beepsGain for clean mixing with music
    gain.connect(this.beepsGain);

    source.start(when);
  }

  playStart() {
    this.playAlarmSound(880, 0.5, true);
  }

  playMiddle() {
    this.playAlarmSound(554.37, 0.3, false);
  }

  playEnd() {
    this.playAlarmSound(880, 0.4, true);
  }

  playWorkoutComplete() {
    this.init();
    if (!this.ctx || !this.beepsGain) return;

    const volume = this.alarmVolume;
    // Pre-schedule slightly ahead for smoother playback
    const when = this.ctx.currentTime + 0.01;

    // Victory fanfare: ascending arpeggio with final chord
    const notes = [
      { freq: 523.25, time: 0, duration: 0.3 },      // C5
      { freq: 659.25, time: 0.15, duration: 0.3 },   // E5
      { freq: 783.99, time: 0.3, duration: 0.3 },    // G5
      { freq: 1046.50, time: 0.45, duration: 0.8 },   // C6 (final note)
    ];

    // Play arpeggio
    notes.forEach(({ freq, time, duration }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, when + time);

      gain.gain.setValueAtTime(0, when + time);
      gain.gain.linearRampToValueAtTime(volume * 0.6, when + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + time + duration);

      osc.connect(gain);
      // Route through beepsGain for clean mixing with music
      gain.connect(this.beepsGain!);

      osc.start(when + time);
      osc.stop(when + time + duration);
    });

    // Add harmonics for richness on final note
    const harmonics = [2, 3];
    harmonics.forEach((harmonic, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.50 * harmonic, when + 0.45);

      const harmonicVolume = volume * 0.3 * Math.pow(0.5, i);
      gain.gain.setValueAtTime(0, when + 0.45);
      gain.gain.linearRampToValueAtTime(harmonicVolume, when + 0.47);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.2);

      osc.connect(gain);
      // Route through beepsGain for clean mixing with music
      gain.connect(this.beepsGain!);

      osc.start(when + 0.45);
      osc.stop(when + 1.2);
    });
  }

  playCountdown(secondsRemaining: number) {
    // Musical countdown — short synthetic cues only (never full custom alarm buffer per tick)
    const notes = [261.63, 293.66, 329.63, 349.23, 392.0]; // C4, D4, E4, F4, G4
    const freq = notes[5 - secondsRemaining] || 440;
    const volume = this.alarmVolume * 0.8;

    const preset =
      this.alarmPreset === "custom" ? "digital" : this.alarmPreset;

    switch (preset) {
      case "digital":
        this.playDigitalBeep(freq, 0.15, volume);
        break;
      case "chime":
        this.playChime(freq, 0.2, volume);
        break;
      case "bell":
        this.playBell(freq, 0.15, volume);
        break;
      case "buzzer":
        this.playBuzzer(freq, 0.15, volume);
        break;
      default:
        this.playDigitalBeep(freq, 0.15, volume);
    }
  }

  testAlarm() {
    this.playStart();
  }

  playPlaylist(playlist: PlaylistTrack[], intervalDurationSeconds: number) {
    this.stopAll();
    if (!playlist || playlist.length === 0) return;

    const withUrl = playlist.filter((t) => this.trackEntries.get(t.audioId)?.url);
    if (withUrl.length === 0) {
      if (playlist.length > 0) {
        console.warn(
          "Playlist tracks could not be played — audio may still be loading or unavailable.",
        );
      }
      return;
    }
    if (withUrl.length < playlist.length) {
      console.warn(
        `${playlist.length - withUrl.length} track(s) skipped — audio not loaded yet.`,
      );
    }

    const totalPlaylistDuration = this.playlistTotalDuration(withUrl);
    const shouldLoop =
      totalPlaylistDuration === 0 ||
      totalPlaylistDuration < intervalDurationSeconds;

    this.playlistState = {
      playlist: withUrl,
      intervalDuration: intervalDurationSeconds,
      currentIndex: 0,
      currentOffset: 0,
      isPaused: false,
      shouldLoop,
      currentGroupIndex: -1,
      groupStartTime: 0,
    };

    this.playNextInPlaylist();
  }

  getCurrentSongInfo() {
    if (!this.playlistState || !this.playlistAudio?.src) return null;

    const track = this.getCurrentPlaylistTrack();
    if (!track) return null;

    const entry = this.trackEntries.get(track.audioId);
    if (!entry) return null;

    const el = this.playlistAudio;
    const duration =
      Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : entry.duration;

    return {
      name: entry.name,
      duration,
      currentTime: el.currentTime,
      index: this.playlistState.currentIndex,
      totalSongs: this.playlistState.playlist.length,
    };
  }
}

export const audioEngine = new AudioEngine();
