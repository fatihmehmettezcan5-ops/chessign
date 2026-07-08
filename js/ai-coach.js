const NIM_URL = '/api/nvidia';
const GEMINI_URL = '/api/gemini';

export const MODELS = [
  { id: 'auto', label: 'Otomatik (DeepSeek öncelik)', group: 'auto' },
  { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro (NVIDIA, hızlı)', group: 'nvidia' },
  { id: 'z-ai/glm-5.2', label: 'GLM-5.2 (NVIDIA, yavaş)', group: 'nvidia' },
  { id: 'qwen/qwen3.5-122b-a10b', label: 'Qwen 3.5 122B (NVIDIA, yavaş)', group: 'nvidia' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google, hızlı)', group: 'google' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (Google)', group: 'google' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Google, yedek)', group: 'google' },
];

export class AICoach {
  constructor(outputId) {
    this.outputEl = document.getElementById(outputId);
    this._busy = false;
    this.model = 'auto';
  }

  setModel(id) { this.model = id; }

  async ask(pgn, fen, question, moveHistory) {
    if (this._busy) return;
    this._busy = true;
    this._showLoading();

    const endpoint = NIM_URL;

    try {
      const response = await this._callBackend(pgn, fen, question, endpoint);
      this._showResult(response.response, response.backend + (response.tried ? ' (denendi: ' + response.tried.join(', ') + ')' : ''));
    } catch (err) {
      this._showError(err.message);
    } finally {
      this._busy = false;
    }
  }

  async _callBackend(pgn, fen, question, endpoint) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pgn,
        fen,
        question,
        model: this.model
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error('Backend error: ' + resp.status + ' ' + err);
    }
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  _showLoading() {
    this.outputEl.innerHTML = '<div class="coach-loading"><div class="spinner"></div> AI Koç oyununuzu analiz ediyor… (model: ' + (this.model === 'auto' ? 'otomatik' : this.model) + ')</div>';
    const backEl = document.getElementById('coachBackend');
    if (backEl) backEl.textContent = 'arka uç: —';
  }

  _showResult(text, backend) {
    this.outputEl.innerHTML = '';
    const pre = document.createElement('div');
    pre.className = 'coach-result';
    pre.textContent = text;
    this.outputEl.appendChild(pre);
    const backEl = document.getElementById('coachBackend');
    if (backEl) backEl.textContent = 'arka uç: ' + backend;
  }

  _showError(msg) {
    this.outputEl.innerHTML = '<div class="coach-error">Hata: ' + this._escape(msg) + '</div>';
  }

  _escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
}
