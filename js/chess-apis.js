export async function fetchChesscomGames(username, year, month) {
  let url;
  if (year && month) {
    url = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${String(month).padStart(2, '0')}`;
  } else {
    const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
    const resp = await fetch(archivesUrl);
    if (!resp.ok) throw new Error('chess.com user not found');
    const data = await resp.json();
    if (!data.archives || data.archives.length === 0) throw new Error('No games found');
    url = data.archives[data.archives.length - 1];
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch games');
  const data = await resp.json();
  return (data.games || []).map(g => ({
    id: g.url,
    white: g.white,
    black: g.black,
    pgn: g.pgn,
    timeClass: g.time_class,
    result: g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '1/2-1/2',
    date: g.end_time ? new Date(g.end_time * 1000).toLocaleDateString() : '?',
    url: g.url
  }));
}

export async function fetchLichessGames(username, max = 20) {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${Math.min(max, 200)}&pgnInJson=true`;
  const resp = await fetch(url, { headers: { Accept: 'application/x-ndjson' } });
  if (!resp.ok) throw new Error('lichess user not found');
  const text = await resp.text();
  const lines = text.trim().split('\n').filter(Boolean);
  return lines.map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).map(g => ({
    id: g.id,
    white: { username: g.players?.white?.user?.name || g.players?.white?.user?.id || '?', rating: g.players?.white?.rating },
    black: { username: g.players?.black?.user?.name || g.players?.black?.user?.id || '?', rating: g.players?.black?.rating },
    pgn: g.pgn,
    timeClass: g.speed,
    result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2',
    date: g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '?',
    url: `https://lichess.org/${g.id}`
  }));
}
