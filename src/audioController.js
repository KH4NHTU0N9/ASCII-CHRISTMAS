import { CONFIG } from './config.js';
import { HolidaySynth } from './audioSynth.js';

/**
 * Policy-compliant audio controller supporting custom MP3 tracks,
 * local drag-and-drop audio files, and automatic Web Audio synth fallback.
 */
export class AudioController {
  constructor(onStatusChange = () => {}) {
    this.onStatusChange = onStatusChange;
    this.synth = new HolidaySynth(CONFIG.audio.tempoBpm, CONFIG.audio.defaultVolume);
    this.audioEl = null;
    this.objectUrl = null;
    this.customFileName = null;
    this.playing = false;
    this.mode = 'idle';
  }

  _notify() {
    this.onStatusChange({
      playing: this.playing,
      mode: this.mode,
      trackName: this.customFileName || (this.mode === 'mp3' ? 'music.mp3' : 'Holiday Synth'),
    });
  }

  _cleanupAudioEl() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
  }

  _revokeObjectUrl() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  async _tryPlayAudioSrc(src) {
    this._cleanupAudioEl();
    const audio = new Audio();
    audio.src = src;
    audio.loop = true;
    audio.volume = CONFIG.audio.defaultVolume;
    await audio.play();
    this.audioEl = audio;
  }

  /**
   * Starts playback on explicit user gesture. Prefers custom/local MP3
   * and falls back gracefully to the Web Audio holiday synthesizer.
   */
  async play() {
    if (this.playing) return;
    this.synth.stop();

    const targetSrc = this.objectUrl || CONFIG.audio.mp3Path;
    if (targetSrc) {
      try {
        await this._tryPlayAudioSrc(targetSrc);
        this.playing = true;
        this.mode = 'mp3';
        this._notify();
        return;
      } catch {
        this._cleanupAudioEl();
      }
    }

    await this.synth.start();
    this.playing = true;
    this.mode = 'synth';
    this._notify();
  }

  pause() {
    this._cleanupAudioEl();
    this.synth.stop();
    this.playing = false;
    this.mode = 'idle';
    this._notify();
  }

  async toggle() {
    if (this.playing) {
      this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Loads a user-picked or dropped local audio file and begins playing immediately.
   * @param {File} file
   */
  async loadLocalFile(file) {
    if (!file) return;
    this.pause();
    this._revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.customFileName = file.name;
    await this.play();
  }

  dispose() {
    this.pause();
    this._revokeObjectUrl();
  }
}
