import { DEFAULT_MIDI, extractFeatures, rms } from './dsp.mjs';

export class NoteClassifier {
  constructor(model) {
    this.model = model;
  }

  predictFeatures(features, signalRms) {
    const { labels, weights, bias, silenceRms } = this.model;
    if (signalRms < silenceRms) return { note: null, confidence: 1, probabilities: labels.map(() => 0) };
    const normalized = this.model.featureMean
      ? features.map((value, i) => (value - this.model.featureMean[i]) / this.model.featureStd[i])
      : features;
    const logits = weights.map((row, classIndex) =>
      row.reduce((sum, weight, i) => sum + weight * normalized[i], bias[classIndex]));
    const max = Math.max(...logits);
    const exps = logits.map(value => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0);
    const probabilities = exps.map(value => value / total);
    let best = 0;
    for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[best]) best = i;
    return { note: labels[best], confidence: probabilities[best], probabilities };
  }

  predict(frame, sampleRate = this.model.sampleRate) {
    return this.predictFeatures(extractFeatures(frame, sampleRate, this.model.midi ?? DEFAULT_MIDI), rms(frame));
  }
}
