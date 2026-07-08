const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = 'You are Chessign AI Coach. Briefly analyze this chess game. Point out 1-3 key mistakes/missed tactics and give concrete learning tips. Be specific and encouraging. Respond in the user\'s language. Keep it under 250 words.';

function trimPgn(pgn) {
  if (!pgn) return '';
  const moves = pgn.split('\n\n').pop().replace(/\[[^\]]*\]/g, '').trim();
  return moves.split(' ').filter(t => t && !/^\d+\.$/.test(t)).slice(0, 120).join(' ');
}

function buildPrompt(pgn, fen, question) {
  let prompt = SYSTEM_PROMPT + '\n\n';
  if (pgn) prompt += 'Moves: ' + trimPgn(pgn) + '\n\n';
  if (fen) prompt += 'Current FEN: ' + fen + '\n\n';
  prompt += 'Question: ' + question + '\n\nGive a concise analysis:';
  return prompt;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout after ' + ms + 'ms')), ms))
  ]);
}

const NVIDIA_MODELS = ['z-ai/glm-5.2', 'qwen/qwen3.5-122b-a10b', 'deepseek-ai/deepseek-v4-pro'];
const GEMINI_MODELS = [
  { name: 'gemini-2.5-flash', budget: 0 },
  { name: 'gemini-flash-latest', budget: 0 },
  { name: 'gemini-2.5-flash-lite', budget: 0 },
];

async function callNim(model, prompt, env, timeoutMs) {
  const key = env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY not configured');
  const resp = await withTimeout(fetch(NIM_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.3
    })
  }), timeoutMs, 'NVIDIA ' + model);
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error('NVIDIA ' + model + ' ' + resp.status + ': ' + err.slice(0, 200));
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

async function callGemini(modelCfg, prompt, env, timeoutMs) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 400, temperature: 0.3 }
  };
  if (modelCfg.budget !== undefined) {
    body.generationConfig.thinkingConfig = { thinkingBudget: modelCfg.budget };
  }
  const resp = await withTimeout(fetch(GEMINI_BASE + '/' + modelCfg.name + ':generateContent?key=' + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }), timeoutMs, 'Gemini ' + modelCfg.name);
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error('Gemini ' + modelCfg.name + ' ' + resp.status + ': ' + err.slice(0, 200));
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors() }); }

  const pgn = body.pgn || '';
  const fen = body.fen || '';
  const question = body.question || 'Analyze this game';
  const requestedModel = (body.model || '').trim();
  const prompt = buildPrompt(pgn, fen, question);
  const tried = [];
  const tryOne = async (label, fn) => {
    tried.push(label);
    try { return await fn(); }
    catch (e) { return { error: e.message }; }
  };

  let response = null, backend = null, lastErr = null;

  if (requestedModel) {
    const nvi = NVIDIA_MODELS.indexOf(requestedModel);
    const gi = GEMINI_MODELS.findIndex(g => g.name === requestedModel);
    if (nvi >= 0) {
      const r = await tryOne(requestedModel, () => callNim(requestedModel, prompt, env, 28000));
      if (!r.error) { response = r; backend = requestedModel; }
      else lastErr = r.error;
    } else if (gi >= 0) {
      const r = await tryOne(requestedModel, () => callGemini(GEMINI_MODELS[gi], prompt, env, 28000));
      if (!r.error) { response = r; backend = requestedModel; }
      else lastErr = r.error;
    }
  }

  if (!response) {
    const r = await tryOne('deepseek-ai/deepseek-v4-pro', () => callNim('deepseek-ai/deepseek-v4-pro', prompt, env, 28000));
    if (!r.error) { response = r; backend = 'deepseek-ai/deepseek-v4-pro'; }
    else lastErr = r.error;
  }
  if (!response) {
    const r = await tryOne('gemini-2.5-flash', () => callGemini(GEMINI_MODELS[0], prompt, env, 28000));
    if (!r.error) { response = r; backend = 'gemini-2.5-flash'; }
    else lastErr = r.error;
  }
  if (!response) {
    for (const m of NVIDIA_MODELS) {
      const r = await tryOne(m, () => callNim(m, prompt, env, 28000));
      if (!r.error) { response = r; backend = m; break; }
      else lastErr = r.error;
    }
  }
  if (!response) {
    for (const g of GEMINI_MODELS) {
      const r = await tryOne(g.name, () => callGemini(g, prompt, env, 28000));
      if (!r.error) { response = r; backend = g.name; break; }
      else lastErr = r.error;
    }
  }

  if (!response) {
    return new Response(JSON.stringify({ error: 'All AI backends failed. Tried: ' + tried.join(', ') + '. Last: ' + lastErr }), { status: 502, headers: cors() });
  }

  return new Response(JSON.stringify({ response, backend, tried }), { status: 200, headers: cors() });
}
