const PIECES = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
};

export class Board {
  constructor(containerId, options = {}) {
    this.el = document.getElementById(containerId);
    this.flipped = false;
    this.onSquareClick = options.onSquareClick || (() => {});
    this.squares = [];
  }

  render(fen, lastMove, selected) {
    this.el.innerHTML = '';
    this.squares = [];
    const rows = fen.split(' ')[0].split('/');
    const files = 'abcdefgh';
    const isFlipped = this.flipped;

    for (let r = 0; r < 8; r++) {
      const rowIdx = isFlipped ? 7 - r : r;
      const row = rows[rowIdx];
      const rank = 8 - rowIdx;
      let col = 0;
      for (const ch of row) {
        if (/[1-8]/.test(ch)) {
          const count = parseInt(ch);
          for (let i = 0; i < count; i++) {
            const fileIdx = isFlipped ? 7 - col : col;
            const sqName = files[fileIdx] + rank;
            this._addSquare(sqName, null, lastMove, selected);
            col++;
          }
        } else {
          const fileIdx = isFlipped ? 7 - col : col;
          const sqName = files[fileIdx] + rank;
          const isWhite = ch === ch.toUpperCase();
          const piece = { color: isWhite ? 'w' : 'b', type: ch.toUpperCase() };
          this._addSquare(sqName, piece, lastMove, selected);
          col++;
        }
      }
    }
  }

  _addSquare(sqName, piece, lastMove, selected) {
    const fileIdx = sqName.charCodeAt(0) - 97;
    const rank = parseInt(sqName[1]);
    const isDark = (fileIdx + rank) % 2 === 1;
    const sq = document.createElement('div');
    sq.className = 'sq ' + (isDark ? 'dark' : 'light');
    sq.dataset.sq = sqName;

    if (lastMove && (sqName === lastMove.from || sqName === lastMove.to)) {
      sq.classList.add('last-move');
    }
    if (selected === sqName) sq.classList.add('selected');

    if (piece) {
      const span = document.createElement('span');
      span.className = 'piece';
      span.textContent = PIECES[piece.color][piece.type];
      sq.appendChild(span);
    }

    sq.addEventListener('click', () => this.onSquareClick(sqName));
    this.el.appendChild(sq);
    this.squares.push(sq);
  }

  flip() {
    this.flipped = !this.flipped;
  }

  highlightSquare(sqName, type) {
    const sq = this.el.querySelector(`[data-sq="${sqName}"]`);
    if (sq) sq.classList.add('highlight', type || '');
  }

  clearHighlights() {
    this.el.querySelectorAll('.highlight').forEach(sq => sq.classList.remove('highlight', 'capture'));
  }
}
