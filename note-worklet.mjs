import { NoteClassifier } from './lib/classifier.mjs';

class PianoNoteProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.model = null; this.classifier = null; this.ring = null;
    this.writeIndex = 0; this.available = 0; this.sinceInference = 0;
    this.phase = 0; this.bucketSum = 0; this.bucketCount = 0;
    this.smoothed = null;
    this.port.onmessage = event => {
      if (event.data.type === 'model') {
        this.model = event.data.model;
        this.classifier = new NoteClassifier(this.model);
        this.ring = new Float32Array(this.model.frameSize);
        this.smoothed = new Float32Array(this.model.labels.length);
      } else if (event.data.type === 'threshold' && this.model) {
        this.model.silenceRms = event.data.value;
      }
    };
  }

  push(value) {
    this.ring[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.ring.length;
    this.available = Math.min(this.available + 1, this.ring.length);
    this.sinceInference++;
    if (this.available < this.ring.length || this.sinceInference < this.model.hopSize) return;
    this.sinceInference = 0;
    const frame = new Float32Array(this.ring.length);
    for (let i = 0; i < frame.length; i++) frame[i] = this.ring[(this.writeIndex + i) % frame.length];
    const started = currentTime;
    const result = this.classifier.predict(frame, this.model.sampleRate);
    if (result.note === null) {
      this.smoothed.fill(0);
      this.port.postMessage({ note: null, confidence: 1, computeMs: (currentTime - started) * 1000 });
      return;
    }
    let best = 0, total = 0;
    for (let i = 0; i < this.smoothed.length; i++) {
      this.smoothed[i] = 0.55 * result.probabilities[i] + 0.45 * this.smoothed[i];
      total += this.smoothed[i];
      if (this.smoothed[i] > this.smoothed[best]) best = i;
    }
    this.port.postMessage({ note: this.model.labels[best], confidence: this.smoothed[best] / total,
      computeMs: (currentTime - started) * 1000 });
  }

  process(inputs) {
    if (!this.classifier || !inputs[0]?.[0]) return true;
    const channel = inputs[0][0];
    const increment = this.model.sampleRate / sampleRate;
    for (const sample of channel) {
      this.bucketSum += sample; this.bucketCount++; this.phase += increment;
      if (this.phase >= 1) {
        this.push(this.bucketSum / this.bucketCount);
        this.phase -= 1; this.bucketSum = 0; this.bucketCount = 0;
      }
    }
    return true;
  }
}
registerProcessor('piano-note-processor', PianoNoteProcessor);
