export function parsePGN(pgnText) {
  const game = new Chess();
  const result = game.load_pgn(pgnText);
  if (!result) throw new Error('Invalid PGN');
  const moves = game.history({ verbose: true });
  const headers = game.header();
  return { game, moves, headers, pgn: game.pgn() };
}

export function gameAtMove(moves, index) {
  const g = new Chess();
  for (let i = 0; i < index && i < moves.length; i++) {
    g.move(moves[i].san || moves[i]);
  }
  return g;
}

export function makeMoveList(moves) {
  const list = [];
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const w = moves[i] ? (moves[i].san || moves[i]) : '';
    const b = moves[i + 1] ? (moves[i + 1].san || moves[i + 1]) : '';
    list.push({ num, w, b, wIdx: i, bIdx: i + 1 });
  }
  return list;
}

export function samplePGN() {
  return `[Event "Casual Game"]
[Site "Online"]
[Date "2024.01.15"]
[White "Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. Bg5 h6 16. Bd2 c5 17. d5 c4 18. Be3 Qc7 19. Qd2 Nc5 20. Rac1 a5 21. Bh6 Nfd7 22. Bxf8 Kxf8 23. Ng5 Kg7 24. Qf4 Nf6 25. Ne6+ Kf8 26. Nxf6 Qd7 27. Qh4 Qe7 28. Qxh6+ Kg8 29. Qh7# 1-0`;
}
