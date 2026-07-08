const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

const SYSTEM_PROMPT = 'You are Chessign AI Coach, a world-class chess coach. Analyze the given chess game (PGN). Point out blunders, missed tactics, positional improvements, and suggest concrete learning points. Be encouraging and specific. Respond in the same language the user writes in. Keep responses under 400 words.';

function buildPrompt(pgn, fen, question) {
  let prompt = SYSTEM_PROMPT + '\n\n';
  if (pgn) prompt += 'Full game PGN:\n' + pgn + '\n\n';
  if (fen) prompt += 'Current position FEN: ' + fen + '\n\n';
  prompt += 'User request: ' + question + '\n\n';
  prompt += 'Provide your analysis:';
  return prompt;
}

async function callNim(pgn, fen, question, env) {
  const key = env.NVIDIA_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY not configured');
  const prompt = buildPrompt(pgn, fen, question);
  const resp = await fetch(NIM_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
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
  return data.choices?.[0]?.message?.content || 'No response';
}

async function callGemini(pgn, fen, question, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const prompt = buildPrompt(pgn, fen, question);
  const resp = await fetch(GEMINI_URL + '?key=' + key, {
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

  let response, backend;
  try {
    response = await callNim(pgn, fen, question, env);
    backend = 'nvidia-nim';
  } catch (nimErr) {
    console.log('NVIDIA NIM failed, falling back to Gemini:', nimErr.message);
    try {
      response = await callGemini(pgn, fen, question, env);
      backend = 'gemini-pro';
    } catch (gemErr) {
      return new Response(JSON.stringify({ error: 'Both AI backends failed. NVIDIA: ' + nimErr.message + '; Gemini: ' + gemErr.message }), { status: 502, headers: cors() });
    }
  }

  return new Response(JSON.stringify({ response, backend }), { status: 200, headers: cors() });
}
