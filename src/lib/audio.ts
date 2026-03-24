/**
 * Audio Engine for TempoTread
 * Uses Web Audio API to synthesize tones
 */

import { PlaylistTrack } from './utils';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private customBuffers: Map<string, { buffer: AudioBuffer, name: string }> = new Map();
  private currentSources: { source: AudioBufferSourceNode, startTime: number, offset: number, buffer: AudioBuffer }[] = [];
  private playlistState: {
    playlist: PlaylistTrack[];
    intervalDuration: number;
    currentIndex: number;
    currentOffset: number;
    isPaused: boolean;
    shouldLoop: boolean;
  } | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  async addCustomAudio(file: File): Promise<string> {
    this.init();
    if (!this.ctx) throw new Error('Audio context not initialized');

    const id = Math.random().toString(36).substr(2, 9);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    
    this.customBuffers.set(id, { buffer, name: file.name });
    return id;
  }

  getAudioLibrary() {
    return Array.from(this.customBuffers.entries()).map(([id, data]) => ({
      id,
      name: data.name
    }));
  }

  removeAudio(id: string) {
    this.customBuffers.delete(id);
  }

  stopAll() {
    this.currentSources.forEach(item => {
      try { item.source.stop(); } catch (e) {}
    });
    this.currentSources = [];
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
    if (!this.ctx || !this.playlistState || !this.playlistState.isPaused) return;
    this.playlistState.isPaused = false;
    this.playNextInPlaylist();
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playBuffer(buffer: AudioBuffer, offset: number = 0): AudioBufferSourceNode | null {
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
      this.currentSources = this.currentSources.filter(s => s.source !== source);
      // Only trigger next if we didn't stop it manually for pause
      if (!this.playlistState?.isPaused && this.currentSources.length === 0) {
        this.onBufferEnded();
      }
    };

    return source;
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

  playStart() {
    this.playTone(440, 'sine', 0.5);
    setTimeout(() => this.playTone(660, 'sine', 0.5), 100);
    setTimeout(() => this.playTone(880, 'sine', 0.5), 200);
  }

  playMiddle() {
    this.playTone(554.37, 'triangle', 0.3, 0.05);
  }

  playEnd() {
    this.playTone(880, 'square', 0.2, 0.05);
    setTimeout(() => this.playTone(440, 'square', 0.4, 0.05), 150);
  }

  playPlaylist(playlist: PlaylistTrack[], intervalDurationSeconds: number) {
    this.stopAll();
    if (!playlist || playlist.length === 0) return;

    const buffers = playlist
      .map(track => this.customBuffers.get(track.audioId)?.buffer)
      .filter((b): b is AudioBuffer => !!b);

    if (buffers.length === 0) return;

    const totalPlaylistDuration = buffers.reduce((acc, b) => acc + b.duration, 0);
    const shouldLoop = totalPlaylistDuration < intervalDurationSeconds;

    this.playlistState = {
      playlist,
      intervalDuration: intervalDurationSeconds,
      currentIndex: 0,
      currentOffset: 0,
      isPaused: false,
      shouldLoop
    };

    this.playNextInPlaylist();
  }

  getCurrentSongInfo() {
    if (!this.playlistState || this.playlistState.isPaused) return null;
    
    const track = this.playlistState.playlist[this.playlistState.currentIndex];
    const data = this.customBuffers.get(track.audioId);
    
    if (!data) return null;

    let currentTime = this.playlistState.currentOffset;
    if (this.currentSources.length > 0 && this.ctx) {
      const active = this.currentSources[0];
      currentTime += (this.ctx.currentTime - active.startTime);
    }

    return {
      name: data.name,
      duration: data.buffer.duration,
      currentTime: currentTime,
      index: this.playlistState.currentIndex,
      totalSongs: this.playlistState.playlist.length
    };
  }

  playCountdown(secondsRemaining: number) {
    // Musical countdown - rhythmic pulse with increasing pitch
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00]; // C4, D4, E4, F4, G4
    const freq = notes[5 - secondsRemaining] || 440;
    this.playTone(freq, 'sine', 0.15, 0.08);
  }
}

export const audioEngine = new AudioEngine();
