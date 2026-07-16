const noteEl = document.querySelector('#note');
const confidenceEl = document.querySelector('#confidence');
const statusEl = document.querySelector('#status');
const latencyEl = document.querySelector('#latency');
const startButton = document.querySelector('#start');
const threshold = document.querySelector('#threshold');
const thresholdValue = document.querySelector('#thresholdValue');
const history = document.querySelector('#history');
let context, worklet, stream, lastNote = null;

async function start() {
  startButton.disabled = true;
  try {
    const model = await fetch('model.json').then(response => {
      if (!response.ok) throw new Error(`model: HTTP ${response.status}`);
      return response.json();
    });
    threshold.value = model.silenceRms;
    thresholdValue.value = Number(model.silenceRms).toFixed(3);
    stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false
    }});
    context = new AudioContext({ latencyHint: 'interactive' });
    await context.audioWorklet.addModule('note-worklet.mjs');
    worklet = new AudioWorkletNode(context, 'piano-note-processor');
    worklet.port.postMessage({ type: 'model', model });
    const source = context.createMediaStreamSource(stream);
    const silent = context.createGain(); silent.gain.value = 0;
    source.connect(worklet).connect(silent).connect(context.destination);
    worklet.port.onmessage = ({ data }) => render(data, model);
    await context.resume();
    const deviceMs = ((context.baseLatency ?? 0) + (context.outputLatency ?? 0)) * 1000;
    latencyEl.textContent = `${model.analysisWindowMs.toFixed(1)} ms window${deviceMs ? ` · ${deviceMs.toFixed(1)} ms audio path` : ''}`;
    statusEl.textContent = `Listening at ${context.sampleRate} Hz`;
    startButton.textContent = 'Stop'; startButton.disabled = false; startButton.onclick = stop;
  } catch (error) {
    statusEl.textContent = error.message; startButton.disabled = false;
  }
}

function render(result) {
  if (!result.note) {
    noteEl.textContent = '—'; confidenceEl.textContent = 'Listening…'; lastNote = null; return;
  }
  noteEl.textContent = result.note;
  confidenceEl.textContent = `${(result.confidence * 100).toFixed(0)}% confidence`;
  if (result.note !== lastNote && result.confidence >= 0.55) {
    const item = document.createElement('li'); item.textContent = result.note; history.append(item);
    while (history.children.length > 16) history.firstElementChild.remove();
    lastNote = result.note;
  }
}

function stop() {
  stream?.getTracks().forEach(track => track.stop()); context?.close();
  worklet = null; context = null; lastNote = null;
  noteEl.textContent = '—'; confidenceEl.textContent = 'Stopped'; statusEl.textContent = 'Ready';
  startButton.textContent = 'Start microphone'; startButton.onclick = start;
}

threshold.addEventListener('input', () => {
  const value = Number(threshold.value); thresholdValue.value = value.toFixed(3);
  worklet?.port.postMessage({ type: 'threshold', value });
});
startButton.onclick = start;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
