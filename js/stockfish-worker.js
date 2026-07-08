const BASE = 'https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0';
const ENGINE_JS = BASE + '/stockfish-18-lite.js';

let engineWorker = null;

async function init() {
  const resp = await fetch(ENGINE_JS);
  if (!resp.ok) throw new Error('Motor dosyası alınamadı: ' + resp.status);
  let code = await resp.text();
  code = code.replace(/locateFile\s*\(.*?\)/g, 'locateFile("' + BASE + '/stockfish-18-lite.wasm")');
  code = code.replace('STOCKFISH_WASM_URL', '"' + BASE + '/stockfish-18-lite.wasm"');
  const blob = new Blob([code], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  engineWorker = new Worker(url);
  engineWorker.onmessage = (e) => {
    const line = typeof e.data === 'string' ? e.data : e.data.data || '';
    if (line) self.postMessage({ t: 'line', d: line });
  };
  engineWorker.onerror = (e) => {
    self.postMessage({ t: 'err', d: 'Engine worker error: ' + (e.message || 'unknown') });
  };
  engineWorker.postMessage('setoption name Use Hash value 16');
  await waitForReady();
  self.postMessage({ t: 'ready' });
}

function waitForReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Engine init timeout')), 15000);
    const handler = (e) => {
      const line = typeof e.data === 'string' ? e.data : e.data.data || '';
      if (line.includes('readyok') || line.includes('uciok')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    engineWorker.addEventListener('message', handler, { once: true });
    engineWorker.postMessage('uci');
  });
}

self.addEventListener('message', (e) => {
  const m = e.data;
  if (m.t === 'init') {
    init().catch((err) => self.postMessage({ t: 'err', d: err.message }));
  } else if (m.t === 'pos' && engineWorker) {
    engineWorker.postMessage('stop');
    engineWorker.postMessage('ucinewgame');
    engineWorker.postMessage('position fen ' + m.fen);
    engineWorker.postMessage('go depth ' + (m.depth || 18));
  } else if (m.t === 'stop' && engineWorker) {
    engineWorker.postMessage('stop');
  } else if (m.t === 'quit' && engineWorker) {
    engineWorker.postMessage('quit');
    engineWorker.terminate();
    engineWorker = null;
  }
});
