export const DEFAULT_MIDI = [60, 62, 64, 65, 67, 69, 71, 72];
export const FEATURE_SIZE = DEFAULT_MIDI.length * 4;

export function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function rms(frame) {
  let sum = 0;
  for (const value of frame) sum += value * value;
  return Math.sqrt(sum / frame.length);
}

function toneStrength(frame, sampleRate, frequency, energy) {
  let re = 0;
  let im = 0;
  const omega = 2 * Math.PI * frequency / sampleRate;
  for (let i = 0; i < frame.length; i++) {
    const windowed = frame[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frame.length - 1)));
    re += windowed * Math.cos(omega * i);
    im -= windowed * Math.sin(omega * i);
  }
  return Math.log1p(20 * Math.sqrt((re * re + im * im) / (energy * frame.length + 1e-12)));
}

function fractionalAutocorrelation(frame, period) {
  const lag0 = Math.floor(period);
  const mix = period - lag0;
  const atLag = (lag) => {
    let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < frame.length - lag; i++) {
      const x = frame[i], y = frame[i + lag];
      xy += x * y; xx += x * x; yy += y * y;
    }
    return xy / Math.sqrt(xx * yy + 1e-12);
  };
  return atLag(lag0) * (1 - mix) + atLag(lag0 + 1) * mix;
}

export function extractFeatures(frame, sampleRate, midiNotes = DEFAULT_MIDI) {
  if (midiNotes.length * 4 !== FEATURE_SIZE) throw new Error(`expected ${DEFAULT_MIDI.length} notes`);
  let energy = 0;
  for (const value of frame) energy += value * value;
  const features = [];
  for (const midi of midiNotes) features.push(toneStrength(frame, sampleRate, midiToHz(midi), energy));
  for (let harmonic = 2; harmonic <= 3; harmonic++) {
    for (const midi of midiNotes) features.push(toneStrength(frame, sampleRate, midiToHz(midi) * harmonic, energy));
  }
  for (const midi of midiNotes) features.push(fractionalAutocorrelation(frame, sampleRate / midiToHz(midi)));
  return features;
}

export function makeSine(frequency, sampleRate, length, amplitude = 1, phase = 0) {
  return Float32Array.from({ length }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate + phase));
}
