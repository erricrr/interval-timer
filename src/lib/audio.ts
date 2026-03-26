/**
 * Audio Engine for TempoTread
 * Uses Web Audio API to synthesize tones
 */

import { ColorGroup, PlaylistTrack } from "./utils";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private customBuffers: Map<string, { buffer: AudioBuffer; name: string }> =
    new Map();
  private currentSources: {
    source: AudioBufferSourceNode;
    startTime: number;
    offset: number;
    buffer: AudioBuffer;
  }[] = [];
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

  // Alarm settings
  private alarmVolume: number = 0.5;
  private alarmPreset: "digital" | "chime" | "bell" | "buzzer" | "custom" = "digital";
  private customAlarmBuffer: AudioBuffer | null = null;
  private customAlarmName: string = "";

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  async addCustomAudio(file: File): Promise<string> {
    this.init();
    if (!this.ctx) throw new Error("Audio context not initialized");

    const id = Math.random().toString(36).substr(2, 9);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);

    this.customBuffers.set(id, { buffer, name: file.name });
    return id;
  }

  getAudioLibrary() {
    return Array.from(this.customBuffers.entries()).map(([id, data]) => ({
      id,
      name: data.name,
    }));
  }

  removeAudio(id: string) {
    this.customBuffers.delete(id);
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

  async setCustomAlarmFile(file: File): Promise<void> {
    this.init();
    if (!this.ctx) throw new Error("Audio context not initialized");

    const arrayBuffer = await file.arrayBuffer();
    this.customAlarmBuffer = await this.ctx.decodeAudioData(arrayBuffer);
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

  stopAll() {
    // Stop all currently playing sources immediately
    this.currentSources.forEach((item) => {
      try {
        item.source.stop();
      } catch (e) {}
    });
    this.currentSources = [];
    // Clear playlist state to prevent any further playback
    this.playlistState = null;
  }

  pauseAll() {
    if (!this.ctx || !this.playlistState || this.playlistState.isPaused) return;

    this.playlistState.isPaused = true;

    // Calculate current offset for the active source
    if (this.currentSources.length > 0) {
      const active = this.currentSources[0];
      const elapsed = this.ctx.currentTime - active.startTime;
      this.playlistState.currentOffset = active.offset + elapsed;

      active.source.stop();
      this.currentSources = [];
    }
  }

  resumePlaylist() {
    if (!this.ctx || !this.playlistState || !this.playlistState.isPaused)
      return;
    this.playlistState.isPaused = false;
    this.playNextInPlaylist();
  }

  private playBuffer(
    buffer: AudioBuffer,
    offset: number = 0,
  ): AudioBufferSourceNode | null {
    this.init();
    if (!this.ctx) return null;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();

    source.buffer = buffer;
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    source.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(0, offset);

    const item = { source, startTime: this.ctx.currentTime, offset, buffer };
    this.currentSources.push(item);

    source.onended = () => {
      this.currentSources = this.currentSources.filter(
        (s) => s.source !== source,
      );
      // Only trigger next if we didn't stop it manually for pause
      if (!this.playlistState?.isPaused && this.currentSources.length === 0) {
        this.onBufferEnded();
      }
    };

    return source;
  }

  // Alarm sound methods with preset support
  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    volume: number,
  ) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + duration,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playDigitalBeep(freq: number, duration: number, volume: number) {
    this.playTone(freq, "square", duration, volume);
  }

  private playChime(freq: number, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;

    // Create a bell-like sound with multiple harmonics
    const harmonics = [1, 2, 3, 4.2];
    harmonics.forEach((harmonic, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * harmonic, this.ctx!.currentTime);

      const harmonicVolume = volume * Math.pow(0.5, i);
      gain.gain.setValueAtTime(0, this.ctx!.currentTime);
      gain.gain.linearRampToValueAtTime(harmonicVolume, this.ctx!.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        this.ctx!.currentTime + duration * (1 + i * 0.3),
      );

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start();
      osc.stop(this.ctx!.currentTime + duration * (1 + i * 0.3));
    });
  }

  private playBell(freq: number, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;

    // Bell sound with strong attack and long decay
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + duration * 1.5,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration * 1.5);
  }

  private playBuzzer(freq: number, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;

    // Buzzer with modulation
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    lfo.type = "square";
    lfo.frequency.setValueAtTime(20, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(freq * 0.1, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + duration,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start();
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    lfo.stop(this.ctx.currentTime + duration);
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
    if (!this.ctx || !this.customAlarmBuffer) return;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();

    source.buffer = this.customAlarmBuffer;
    gain.gain.setValueAtTime(this.alarmVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + this.customAlarmBuffer.duration,
    );

    source.connect(gain);
    gain.connect(this.ctx.destination);

    source.start();
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
    if (!this.ctx) return;

    const volume = this.alarmVolume;
    const now = this.ctx.currentTime;

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
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(volume * 0.6, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);
    });

    // Add harmonics for richness on final note
    const harmonics = [2, 3];
    harmonics.forEach((harmonic, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.50 * harmonic, now + 0.45);

      const harmonicVolume = volume * 0.3 * Math.pow(0.5, i);
      gain.gain.setValueAtTime(0, now + 0.45);
      gain.gain.linearRampToValueAtTime(harmonicVolume, now + 0.47);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + 0.45);
      osc.stop(now + 1.2);
    });
  }

  playCountdown(secondsRemaining: number) {
    // Musical countdown - rhythmic pulse with increasing pitch
    const notes = [261.63, 293.66, 329.63, 349.23, 392.0]; // C4, D4, E4, F4, G4
    const freq = notes[5 - secondsRemaining] || 440;
    const volume = this.alarmVolume * 0.8;

    if (this.alarmPreset === "custom" && this.customAlarmBuffer) {
      this.playCustomAlarm();
      return;
    }

    switch (this.alarmPreset) {
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

  private onBufferEnded() {
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

  private playNextInPlaylist() {
    if (!this.playlistState || this.playlistState.isPaused) return;

    const track = this.playlistState.playlist[this.playlistState.currentIndex];
    const buffer = this.customBuffers.get(track.audioId)?.buffer;

    if (buffer) {
      this.playBuffer(buffer, this.playlistState.currentOffset);
    } else {
      // Skip missing buffers
      this.onBufferEnded();
    }
  }

  playPlaylist(playlist: PlaylistTrack[], intervalDurationSeconds: number) {
    this.stopAll();
    if (!playlist || playlist.length === 0) return;

    const buffers = playlist
      .map((track) => this.customBuffers.get(track.audioId)?.buffer)
      .filter((b): b is AudioBuffer => !!b);

    if (buffers.length === 0) return;

    const totalPlaylistDuration = buffers.reduce(
      (acc, b) => acc + b.duration,
      0,
    );
    const shouldLoop = totalPlaylistDuration < intervalDurationSeconds;

    this.playlistState = {
      playlist,
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

  // Group-aware playback: starts fresh or continues within same group
  playPlaylistForGroup(
    playlist: PlaylistTrack[],
    groupDuration: number,
    groupIndex: number,
    isSameGroup: boolean,
  ) {
    if (!isSameGroup) {
      // Different group - start fresh
      this.stopAll();
      if (!playlist || playlist.length === 0) return;

      const buffers = playlist
        .map((track) => this.customBuffers.get(track.audioId)?.buffer)
        .filter((b): b is AudioBuffer => !!b);

      if (buffers.length === 0) return;

      const totalPlaylistDuration = buffers.reduce(
        (acc, b) => acc + b.duration,
        0,
      );
      const shouldLoop = totalPlaylistDuration < groupDuration;

      this.playlistState = {
        playlist,
        intervalDuration: groupDuration,
        currentIndex: 0,
        currentOffset: 0,
        isPaused: false,
        shouldLoop,
        currentGroupIndex: groupIndex,
        groupStartTime: this.ctx?.currentTime || 0,
      };

      this.playNextInPlaylist();
    }
    // Same group - do nothing, audio continues playing
  }

  // Check if we're currently in a specific group
  isInGroup(groupIndex: number): boolean {
    return this.playlistState?.currentGroupIndex === groupIndex;
  }

  getCurrentSongInfo() {
    if (!this.playlistState || this.playlistState.isPaused) return null;

    const track = this.playlistState.playlist[this.playlistState.currentIndex];
    const data = this.customBuffers.get(track.audioId);

    if (!data) return null;

    let currentTime = this.playlistState.currentOffset;
    if (this.currentSources.length > 0 && this.ctx) {
      const active = this.currentSources[0];
      currentTime += this.ctx.currentTime - active.startTime;
    }

    return {
      name: data.name,
      duration: data.buffer.duration,
      currentTime: currentTime,
      index: this.playlistState.currentIndex,
      totalSongs: this.playlistState.playlist.length,
    };
  }
}

export const audioEngine = new AudioEngine();
