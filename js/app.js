import { showToast } from './toast.js';
import { parsePGN, gameAtMove, makeMoveList, samplePGN } from './pgn.js';
import { fetchChesscomGames, fetchLichessGames } from './chess-apis.js';
import { Board } from './board.js';
import { StockfishEngine } from './stockfish.js';
import { AICoach } from './ai-coach.js';

const S = {
  moves: [], headers: {}, currentIdx: 0, game: null, pgn: '',
  engine: null, board: null, coach: null,
  playing: false, playTimer: null, analyzing: false, aborted: false
};

const $ = (id) => document.getElementById(id);

function init() {
  S.board = new Board('chessBoard', { onSquareClick: (sq) => {} });
  S.coach = new AICoach('coachOutput');
  S.engine = new StockfishEngine();
  S.engine.onEval((ev) => updateEval(ev));
  S.engine.onBestMove((bm) => { $('bestMove').textContent = bm || '—'; });
  S.engine.init().then(() => {
    $('engineDot').className = 'status-dot ready';
    $('engineStatus').textContent = 'Motor: hazır (Stockfish 18 Lite WASM)';
  }).catch((e) => {
    $('engineDot').className = 'status-dot';
    $('engineStatus').textContent = 'Motor: kullanılamıyor (' + e.message + ')';
    showToast('Stockfish motoru yüklenemedi: ' + e.message, 'error');
  });
  bindUI();
}

function bindUI() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  $('loadPgnBtn').addEventListener('click', loadPGN);
  $('loadSampleBtn').addEventListener('click', () => { $('pgnInput').value = samplePGN(); loadPGN(); });
  $('fetchChesscomBtn').addEventListener('click', loadChesscom);
  $('fetchLichessBtn').addEventListener('click', loadLichess);
  $('prevBtn').addEventListener('click', () => goMove(-1));
  $('nextBtn').addEventListener('click', () => goMove(1));
  $('startBtn').addEventListener('click', () => goToMove(0));
  $('endBtn').addEventListener('click', () => goToMove(S.moves.length));
  $('playBtn').addEventListener('click', togglePlay);
  $('flipBtn').addEventListener('click', () => { S.board.flip(); showPosition(); });
  $('analyzeBtn').addEventListener('click', analyzeFull);
  $('abortBtn').addEventListener('click', abortAnalysis);
  $('runCoachBtn').addEventListener('click', runCoach);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.hidden = p.id !== 'tab-' + tab;
    p.classList.toggle('active', p.id === 'tab-' + tab);
  });
}

function loadPGN() {
  const text = $('pgnInput').value.trim();
  if (!text) { showToast('Önce bir PGN yapıştırın', 'error'); return; }
  try {
    const parsed = parsePGN(text);
    applyGame(parsed);
    showToast('Oyun başarıyla yüklendi', 'success');
  } catch (e) {
    showToast('Geçersiz PGN: ' + e.message, 'error');
  }
}

async function loadChesscom() {
  const user = $('chesscomUser').value.trim();
  if (!user) { showToast('Bir chess.com kullanıcı adı girin', 'error'); return; }
  const year = parseInt($('chesscomYear').value) || null;
  const month = parseInt($('chesscomMonth').value) || null;
  const list = $('chesscomGamesList');
  list.innerHTML = '<div class="hint">Yükleniyor…</div>';
  try {
    const games = await fetchChesscomGames(user, year, month);
    list.innerHTML = '';
    if (games.length === 0) { list.innerHTML = '<div class="hint">Oyun bulunamadı</div>'; return; }
    games.forEach(g => {
      const item = document.createElement('div');
      item.className = 'game-item';
      item.innerHTML = `<span>${g.white.username} vs ${g.black.username}</span><span class="game-meta">${g.result} · ${g.date}</span>`;
      item.addEventListener('click', () => loadPGNText(g.pgn));
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = '<div class="hint" style="color:var(--red)">Hata: ' + e.message + '</div>';
  }
}

async function loadLichess() {
  const user = $('lichessUser').value.trim();
  if (!user) { showToast('Bir lichess kullanıcı adı girin', 'error'); return; }
  const max = parseInt($('lichessMax').value) || 20;
  const list = $('lichessGamesList');
  list.innerHTML = '<div class="hint">Yükleniyor…</div>';
  try {
    const games = await fetchLichessGames(user, max);
    list.innerHTML = '';
    if (games.length === 0) { list.innerHTML = '<div class="hint">Oyun bulunamadı</div>'; return; }
    games.forEach(g => {
      const item = document.createElement('div');
      item.className = 'game-item';
      item.innerHTML = `<span>${g.white.username} vs ${g.black.username}</span><span class="game-meta">${g.result} · ${g.date}</span>`;
      item.addEventListener('click', () => loadPGNText(g.pgn));
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = '<div class="hint" style="color:var(--red)">Hata: ' + e.message + '</div>';
  }
}

function loadPGNText(pgnText) {
  try {
    const parsed = parsePGN(pgnText);
    applyGame(parsed);
    showToast('Oyun yüklendi', 'success');
  } catch (e) {
    showToast('Oyun yüklenemedi: ' + e.message, 'error');
  }
}

function applyGame(parsed) {
  S.game = parsed.game;
  S.moves = parsed.moves;
  S.headers = parsed.headers;
  S.pgn = parsed.pgn;
  S.currentIdx = 0;
  S.analyzing = false;
  S.aborted = false;
  S.playing = false;
  if (S.playTimer) { clearInterval(S.playTimer); S.playTimer = null; }
  $('playBtn').textContent = '▶';
  $('importPanel').hidden = true;
  $('reviewPanel').hidden = false;
  $('abortBtn').hidden = true;
  $('analyzeBtn').hidden = false;
  updatePlayerInfo();
  renderMoveList();
  showPosition();
}

function updatePlayerInfo() {
  const h = S.headers;
  $('whiteName').textContent = h.White || 'White';
  $('blackName').textContent = h.Black || 'Black';
  $('whiteRating').textContent = h.WhiteElo ? '(' + h.WhiteElo + ')' : '';
  $('blackRating').textContent = h.BlackElo ? '(' + h.BlackElo + ')' : '';
}

function showPosition() {
  if (S.moves.length === 0) { S.board.render('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); return; }
  const g = gameAtMove(S.moves, S.currentIdx);
  const fen = g.fen();
  const lastMove = S.currentIdx > 0 ? S.moves[S.currentIdx - 1] : null;
  S.board.render(fen, lastMove, null);
  document.querySelectorAll('.ml-w.active, .ml-b.active').forEach(el => el.classList.remove('active'));
  if (S.currentIdx > 0) {
    const idx = S.currentIdx - 1;
    const allMoves = $('moveList').querySelectorAll('.ml-w, .ml-b');
    if (allMoves[idx]) allMoves[idx].classList.add('active');
  }
  $('moveNumber').textContent = S.currentIdx;
  $('moveTotal').textContent = S.moves.length;
  if (S.engine && S.engine.ready) {
    S.engine.analyze(fen);
    $('engineDot').className = 'status-dot busy';
    $('engineStatus').textContent = 'Motor: analiz ediliyor…';
  }
}

function goMove(delta) {
  const next = Math.max(0, Math.min(S.moves.length, S.currentIdx + delta));
  if (next !== S.currentIdx) { S.currentIdx = next; showPosition(); }
}

function goToMove(idx) {
  S.currentIdx = Math.max(0, Math.min(S.moves.length, idx));
  showPosition();
}

function togglePlay() {
  S.playing = !S.playing;
  $('playBtn').textContent = S.playing ? '⏸' : '▶';
  if (S.playing) {
    if (S.currentIdx >= S.moves.length) S.currentIdx = 0;
    S.playTimer = setInterval(() => {
      if (S.currentIdx >= S.moves.length) { togglePlay(); return; }
      goMove(1);
    }, 1200);
  } else {
    if (S.playTimer) { clearInterval(S.playTimer); S.playTimer = null; }
  }
}

function renderMoveList() {
  const container = $('moveList');
  container.innerHTML = '';
  const pairs = makeMoveList(S.moves);
  pairs.forEach(p => {
    const num = document.createElement('span'); num.className = 'ml-num'; num.textContent = p.num + '.';
    const w = document.createElement('span'); w.className = 'ml-w'; w.textContent = p.w;
    w.dataset.idx = p.wIdx;
    w.addEventListener('click', () => goToMove(p.wIdx + 1));
    const b = document.createElement('span'); b.className = 'ml-b'; b.textContent = p.b;
    b.dataset.idx = p.bIdx;
    b.addEventListener('click', () => goToMove(p.bIdx + 1));
    container.appendChild(num); container.appendChild(w); container.appendChild(b);
  });
}

function updateEval(ev) {
  const s = ev.score;
  const fill = document.getElementById('evalFill');
  const label = document.getElementById('evalLabel');
  const pct = Math.max(0, Math.min(100, 50 + s * 5));
  fill.style.width = pct + '%';
  if (ev.mate) {
    label.textContent = (s > 0 ? '+M' : '-M') + Math.abs(Math.round(s));
  } else {
    label.textContent = (s > 0 ? '+' : '') + s.toFixed(2);
  }
  $('currentEval').textContent = label.textContent;
  $('engineDot').className = 'status-dot ready';
  $('engineStatus').textContent = 'Motor: derinlik ' + ev.depth + ' (Stockfish 18 Lite)';
}

function analyzeFull() {
  if (S.moves.length === 0) return;
  S.analyzing = true;
  S.aborted = false;
  $('analyzeBtn').hidden = true;
  $('abortBtn').hidden = false;
  $('engineDot').className = 'status-dot busy';
  $('engineStatus').textContent = 'Motor: tam analiz…';
  showToast('Tüm pozisyonlar analiz ediliyor…', 'info');
  runAnalysis(0);
}

function runAnalysis(idx) {
  if (!S.analyzing || S.aborted || idx > S.moves.length) {
    finishAnalysis();
    return;
  }
  S.currentIdx = idx;
  showPosition();
  setTimeout(() => {
    if (S.analyzing && !S.aborted) runAnalysis(idx + 1);
  }, 200);
}

function abortAnalysis() {
  S.aborted = true; S.analyzing = false;
  if (S.engine) S.engine.stop();
  $('abortBtn').hidden = true; $('analyzeBtn').hidden = false;
  showToast('Analiz durduruldu', 'info');
}

function finishAnalysis() {
  S.analyzing = false;
  $('abortBtn').hidden = true; $('analyzeBtn').hidden = false;
  $('engineDot').className = 'status-dot ready';
  $('engineStatus').textContent = 'Motor: bekliyor';
  showToast('Analiz tamamlandı', 'success');
}

async function runCoach() {
  if (!S.pgn) { showToast('Önce bir oyun yükleyin', 'error'); return; }
  const question = $('coachQuestion').value.trim() || 'Bu oyunu analiz et. Önemli anlar, hatalar nelerdi ve ne öğrenebilirim?';
  $('coachPanel').hidden = false;
  await S.coach.ask(S.pgn, '', question, []);
}

document.addEventListener('DOMContentLoaded', init);
