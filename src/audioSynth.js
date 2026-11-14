// MIDI-to-Hz helper
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Public-domain festive medley ("We Wish You a Merry Christmas" + warm 80s pad chords)
// Each entry: [melodyMidiOrNull, chordMidis, durationBeats]
const HOLIDAY_SCORE = [
  // Pickup & Phrase 1
  [62, [55, 59, 62], 1],
  [67, [55, 59, 62], 1],
  [67, null, 0.5],
  [69, null, 0.5],
  [67, null, 0.5],
  [66, null, 0.5],
  [64, [52, 55, 60], 1],
  [64, null, 1],
  [64, null, 1],
  // Phrase 2
  [69, [57, 60, 64], 1],
  [69, null, 0.5],
  [71, null, 0.5],
  [69, null, 0.5],
  [67, null, 0.5],
  [66, [54, 57, 62], 1],
  [62, null, 1],
  [62, null, 1],
  // Phrase 3
  [71, [55, 59, 64], 1],
  [71, null, 0.5],
  [72, null, 0.5],
  [71, null, 0.5],
  [69, null, 0.5],
  [67, [52, 55, 60], 1],
  [64, null, 1],
  [62, null, 0.5],
  [62, null, 0.5],
  // Cadence
  [64, [57, 60, 64], 1],
  [69, [54, 57, 62], 1],
  [66, null, 1],
  [67, [55, 59, 62], 2],
  [null, null, 1],
];

/**
 * Polyphonic Web Audio API holiday chime & warm pad synthesizer.
 * Runs 100% offline with zero external audio dependencies.
 */
export class HolidaySynth {
  constructor(bpm = 112, volume = 0.6) {
    this.bpm = bpm;
    this.volume = volume;
    this.ctx = null;
    this.masterGain = null;
    this.delayNode = null;
    this.timerId = null;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.isPlaying = false;
  }

  _ensureContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume * 0.45;

    // Gentle stereo-feel echo delay
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.value = 0.28;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.28;
    const wetFilter = this.ctx.createBiquadFilter();
    wetFilter.type = 'lowpass';
    wetFilter.frequency.value = 2400;

    this.delayNode.connect(wetFilter);
    wetFilter.connect(feedback);
    feedback.connect(this.delayNode);
    wetFilter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol * 0.45, this.ctx.currentTime, 0.04);
    }
  }

  _playBell(freq, startTime, durationSec) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    const g2 = this.ctx.createGain();
    g2.gain.value = 0.22;

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.28, startTime + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0008, startTime + durationSec * 1.15);

    osc1.connect(env);
    osc2.connect(g2);
    g2.connect(env);
    env.connect(this.masterGain);
    env.connect(this.delayNode);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + durationSec * 1.2 + 0.05);
    osc2.stop(startTime + durationSec * 1.2 + 0.05);
  }

  _playPadChord(chordMidis, startTime, durationSec) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.09, startTime + 0.14);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

    filter.connect(env);
    env.connect(this.masterGain);

    for (let i = 0; i < chordMidis.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(chordMidis[i]), startTime);
      osc.connect(filter);
      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.05);
    }
  }

  _scheduleAhead() {
    if (!this.isPlaying || !this.ctx) return;
    const secPerBeat = 60 / this.bpm;

    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const [melody, chord, beats] = HOLIDAY_SCORE[this.stepIndex];
      const dur = beats * secPerBeat;

      if (melody !== null) {
        this._playBell(midiToFreq(melody), this.nextNoteTime, Math.max(0.35, dur));
      }
      if (chord !== null) {
        this._playPadChord(chord, this.nextNoteTime, dur * 2.2);
      }

      this.nextNoteTime += dur;
      this.stepIndex = (this.stepIndex + 1) % HOLIDAY_SCORE.length;
    }
  }

  async start() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this._scheduleAhead();
    this.timerId = window.setInterval(() => this._scheduleAhead(), 80);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
