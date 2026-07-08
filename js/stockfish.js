export class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this._evalCb = null;
    this._bestCb = null;
    this._errCb = null;
    this._bestMove = '';
    this._currentScore = null;
    this._currentDepth = 0;
    this._currentPv = '';
  }

  init() {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('js/stockfish-worker.js');
        this.worker.onmessage = (e) => {
          const m = e.data;
          if (m.t === 'ready') {
            this.ready = true;
            resolve();
          } else if (m.t === 'err') {
            reject(new Error(m.d));
          } else if (m.t === 'line') {
            this._parse(m.d);
          }
        };
        this.worker.onerror = (e) => reject(new Error('Worker error: ' + e.message));
        this.worker.postMessage({ t: 'init' });
      } catch (e) { reject(e); }
    });
  }

  _parse(line) {
    if (line.startsWith('info')) {
      const sc = line.match(/score (cp|mate) (-?\d+)/);
      if (sc) {
        let s;
        if (sc[1] === 'mate') {
          const m = parseInt(sc[2]);
          s = m > 0 ? 100 - m : -100 - m;
        } else {
          s = parseInt(sc[2]) / 100;
        }
        this._currentScore = s;
        const dp = line.match(/depth (\d+)/);
        this._currentDepth = dp ? parseInt(dp[1]) : 0;
        const pv = line.match(/ pv (.+)/);
        this._currentPv = pv ? pv[1] : '';
        if (this._evalCb) this._evalCb({ score: s, depth: this._currentDepth, pv: this._currentPv, mate: sc[1] === 'mate' });
      }
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      this._bestMove = parts[1] || '';
      if (this._bestCb) this._bestCb(this._bestMove);
    }
  }

  analyze(fen, depth) {
    if (!this.ready) return;
    this._bestMove = '';
    this._currentScore = null;
    this.worker.postMessage({ t: 'pos', fen, depth: depth || 18 });
  }

  stop() {
    if (this.worker) this.worker.postMessage({ t: 'stop' });
  }

  onEval(cb) { this._evalCb = cb; }
  onBestMove(cb) { this._bestCb = cb; }
  onError(cb) { this._errCb = cb; }

  destroy() {
    this.stop();
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this.ready = false;
  }
}
