const NIM_URL = '/api/nvidia';
const GEMINI_URL = '/api/gemini';
const SYSTEM_PROMPT = 'Sen Chessign AI Koçusun, dünya çapında bir satranç koçusun. Verilen satranç oyununu (PGN) analiz et. Hataları, kaçırılan taktikleri, pozisyonel iyileştirmeleri işaret et ve somut öğrenme noktaları öner. Teşvik edici ve spesifik ol. Türkçe yanıt ver. Yanıtlar 400 kelimenin altında olsun.';

function buildPrompt(pgn, fen, question) {
  let prompt = SYSTEM_PROMPT + '\n\n';
  if (pgn) prompt += 'Full game PGN:\n' + pgn + '\n\n';
  if (fen) prompt += 'Current position FEN: ' + fen + '\n\n';
  prompt += 'User request: ' + question + '\n\n';
  prompt += 'Provide your analysis:';
  return prompt;
}

export class AICoach {
  constructor(outputId) {
    this.outputEl = document.getElementById(outputId);
    this._busy = false;
  }

  async ask(pgn, fen, question, moveHistory) {
    if (this._busy) return;
    this._busy = true;
    this._showLoading();

    const prompt = buildPrompt(pgn, fen, question);

    try {
      const response = await this._callNim(prompt);
      this._showResult(response.response, response.backend);
    } catch (nimErr) {
      try {
        const response = await this._callGemini(prompt);
        this._showResult(response.response, response.backend);
      } catch (gemErr) {
        this._showError('Her iki AI arka ucu da başarısız oldu. NVIDIA: ' + nimErr.message + '; Gemini: ' + gemErr.message);
      }
    } finally {
      this._busy = false;
    }
  }

  async _callNim(prompt) {
    const resp = await fetch(NIM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error('NVIDIA API error: ' + resp.status + ' ' + err);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || 'No response';
    return { response: text, backend: 'nvidia-nim' };
  }

  async _callGemini(prompt) {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.3 }
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error('Gemini API error: ' + resp.status + ' ' + err);
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    return { response: text, backend: 'gemini-pro' };
  }

  _showLoading() {
    this.outputEl.innerHTML = '<div class="coach-loading"><div class="spinner"></div> AI Koç oyununuzu analiz ediyor…</div>';
    const backEl = document.getElementById('coachBackend');
    if (backEl) backEl.textContent = 'arka uç: —';
  }

  _showResult(text, backend) {
    this.outputEl.innerHTML = '';
    const pre = document.createElement('div');
    pre.textContent = text;
    this.outputEl.appendChild(pre);
    const backEl = document.getElementById('coachBackend');
    if (backEl) backEl.textContent = 'arka uç: ' + backend;
  }

  _showError(msg) {
    this.outputEl.innerHTML = '<div class="coach-error">Error: ' + this._escape(msg) + '</div>';
  }

  _escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
}