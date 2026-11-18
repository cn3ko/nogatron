'use strict';

/* ---------- Game data ---------- */

const COLS = 10;
const ROWS = 14;
const FLASH_MS = 260;
const LOCK_MS = 500;
const MAX_LOCK_RESETS = 15;
const ROWS_PER_LEVEL = 10;
const PICTURE_ROWS = 10;
const CLEAR_POINTS = [0, 100, 200, 500, 800];
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'];

const SHAPES = {
  I: ['....', 'XXXX', '....', '....'],
  O: ['XX', 'XX'],
  T: ['.X.', 'XXX', '...'],
  S: ['.XX', 'XX.', '...'],
  Z: ['XX.', '.XX', '...'],
  J: ['X..', 'XXX', '...'],
  L: ['..X', 'XXX', '...']
};

const COLORS = {
  I: '#19e3d6', O: '#ffd23f', T: '#b57bff', S: '#7df25a',
  Z: '#ff2e93', J: '#3f7dff', L: '#ff8a3d'
};

const PICTURES = [
  { name: 'Sailboat', color: '#19e3d6', rows: ['.....#....', '....##....', '...###....', '..####.#..', '.#####.##.', '.....#....', '##########', '.########.', '..######..', '#.##.##.#.'] },
  { name: 'House', color: '#ff8a3d', rows: ['....##....', '...####...', '..######..', '.########.', '##########', '.########.', '.##.##.##.', '.##.##.##.', '.#####.##.', '.########.'] },
  { name: 'Tree', color: '#7df25a', rows: ['....##....', '...####...', '..######..', '...####...', '..######..', '.########.', '##########', '....##....', '....##....', '..######..'] },
  { name: 'Fish', color: '#ff2e93', rows: ['.....##...', '...#####..', '#.#######.', '###.#####.', '##########', '##########', '#.#######.', '...#####..', '.....##...', '.....#....'] },
  { name: 'Cat', color: '#b57bff', rows: ['#........#', '##......##', '##########', '#.##..##.#', '##########', '###.##.###', '####..####', '.########.', '..######..', '...#..#...'] }
];

/** Most runs a clue may have from each level on, so clues get harder as the game goes on. */
const CLUE_LIMITS = [
  { fromLevel: 1, maxRuns: 1 },
  { fromLevel: 3, maxRuns: 2 },
  { fromLevel: 5, maxRuns: Infinity }
];

/* ---------- Clue rules ---------- */

/**
 * Get the lengths of the filled runs in a line.
 *
 * :param line: array of cells, where a truthy value means filled
 * :return: array of run lengths from left to right
 */
function runsOf(line) {
  const runs = [];
  let length = 0;
  for (const cell of line) {
    if (cell) {
      length += 1;
    } else if (length) {
      runs.push(length);
      length = 0;
    }
  }
  if (length) runs.push(length);
  return runs;
}

/**
 * Check whether a line matches its clue exactly.
 *
 * :param clue: array of run lengths
 * :param line: array of cells
 * :return: true when the runs equal the clue
 */
function matchesClue(clue, line) {
  const runs = runsOf(line);
  return runs.length === clue.length && runs.every((run, i) => run === clue[i]);
}

/**
 * Check whether more cells could still make a line match its clue.
 *
 * :param clue: array of run lengths
 * :param line: array of cells
 * :return: true when a valid arrangement covers every filled cell
 */
function canStillMatch(clue, line) {
  const fit = (clueIndex, start) => {
    if (clueIndex === clue.length) {
      return line.slice(start).every((cell) => !cell);
    }
    const run = clue[clueIndex];
    for (let at = start; at + run <= line.length; at += 1) {
      const clearAfter = at + run === line.length || !line[at + run];
      if (clearAfter && fit(clueIndex + 1, at + run + 1)) return true;
      if (line[at]) return false;
    }
    return false;
  };
  return fit(0, 0);
}

/**
 * Check whether one more cell would complete a line.
 *
 * :param clue: array of run lengths
 * :param line: array of cells
 * :return: true when a single empty cell can be filled to match the clue
 */
function isOneAway(clue, line) {
  return line.some((cell, i) => {
    if (cell) return false;
    const copy = line.slice();
    copy[i] = 'X';
    return matchesClue(clue, copy);
  });
}

/* ---------- Game state ---------- */

/**
 * Shuffle an array in place.
 *
 * :param items: array to shuffle
 * :return: the same array
 */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Find the most runs a clue may have at a level.
 *
 * :param level: current level
 * :return: highest allowed number of runs
 */
function maxClueRuns(level) {
  return CLUE_LIMITS.filter((limit) => level >= limit.fromLevel).pop().maxRuns;
}

/**
 * Turn a shape drawing into a matrix of booleans.
 *
 * :param type: piece letter
 * :return: square matrix for the piece
 */
function shapeMatrix(type) {
  return SHAPES[type].map((row) => [...row].map((ch) => ch === 'X'));
}

/**
 * Rotate a square matrix by a quarter turn.
 *
 * :param matrix: square matrix
 * :param direction: 1 for clockwise, -1 for counterclockwise
 * :return: rotated copy
 */
function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  return matrix.map((row, y) => row.map((_, x) => (
    direction > 0 ? matrix[size - 1 - x][y] : matrix[x][size - 1 - y]
  )));
}

/** The rules of one play session, with no drawing or input code. */
class Game {
  /** Create a game ready to start. */
  constructor() {
    this.reset();
  }

  /** Put everything back to the start of a new game. */
  reset() {
    this.status = 'ready';
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.bestClear = 0;
    this.burned = 0;
    this.pictureOrder = shuffle(PICTURES.map((_, i) => i));
    this.currentSequence = 0;
    this.paintedRows = 0;
    this.clueQueue = [];
    this.clueQueueRuns = 0;
    this.bag = [];
    this.nextPieces = [];
    this.holdType = null;
    this.canHold = true;
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.softDrop = false;
    this.clearing = null;
    this.banner = null;
    this.completed = null;
    this.rows = [];
    for (let y = 0; y < ROWS; y += 1) this.rows.unshift(this.newRow());
    this.refillNext();
    this.spawn(this.nextPieces.shift());
  }

  /**
   * Find the picture for a sequence number.
   *
   * :param sequence: running picture number in this game
   * :return: picture data
   */
  pictureFor(sequence) {
    const order = this.pictureOrder;
    return PICTURES[order[sequence % order.length]];
  }

  /**
   * Build an empty board row with the next clue.
   *
   * :return: row object
   */
  newRow() {
    const maxRuns = maxClueRuns(this.level);
    if (!this.clueQueue.length || maxRuns !== this.clueQueueRuns) {
      const clues = PICTURES.flatMap((picture) => picture.rows.map(
        (text) => runsOf([...text].map((ch) => ch === '#'))
      ));
      this.clueQueue = shuffle(clues.filter((clue) => clue.length <= maxRuns));
      this.clueQueueRuns = maxRuns;
    }
    const clue = this.clueQueue.shift();
    return { clue, cells: Array(COLS).fill(null), jam: false, near: false };
  }

  /** Keep the preview queue filled from shuffled sets of all seven pieces. */
  refillNext() {
    while (this.nextPieces.length < 4) {
      if (!this.bag.length) this.bag = shuffle(Object.keys(SHAPES));
      this.nextPieces.push(this.bag.pop());
    }
  }

  /**
   * Put a new piece at the top of the board, or end the game if blocked.
   *
   * :param type: piece letter
   */
  spawn(type) {
    const matrix = shapeMatrix(type);
    const top = matrix.findIndex((row) => row.some(Boolean));
    this.active = { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: -top };
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.refillNext();
    if (this.collides(this.active.matrix, this.active.x, this.active.y)) {
      this.status = 'over';
    }
  }

  /**
   * Check whether a piece position hits a wall, the floor or a block.
   *
   * :param matrix: piece matrix
   * :param px: left position
   * :param py: top position
   * :return: true when the position is not allowed
   */
  collides(matrix, px, py) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix.length; x += 1) {
        if (!matrix[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.rows[by].cells[bx]) return true;
      }
    }
    return false;
  }

  /** Give the player a little more time after a move on the ground. */
  touchLock() {
    if (this.lockTimer > 0 && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets += 1;
    }
  }

  /**
   * Move the active piece sideways.
   *
   * :param dx: columns to move
   * :return: true when the piece moved
   */
  move(dx) {
    if (this.status !== 'playing') return false;
    const a = this.active;
    if (this.collides(a.matrix, a.x + dx, a.y)) return false;
    a.x += dx;
    this.touchLock();
    return true;
  }

  /**
   * Rotate the active piece, nudging it sideways if needed.
   *
   * :param direction: 1 for clockwise, -1 for counterclockwise
   * :return: true when the piece rotated
   */
  rotate(direction) {
    if (this.status !== 'playing' || this.active.type === 'O') return false;
    const a = this.active;
    const turned = rotateMatrix(a.matrix, direction);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this.collides(turned, a.x + kick, a.y)) {
        a.matrix = turned;
        a.x += kick;
        this.touchLock();
        return true;
      }
    }
    return false;
  }

  /**
   * Find how far the active piece can fall.
   *
   * :return: lowest top position for the piece
   */
  ghostY() {
    const a = this.active;
    let y = a.y;
    while (!this.collides(a.matrix, a.x, y + 1)) y += 1;
    return y;
  }

  /** Drop the active piece to the floor and lock it. */
  hardDrop() {
    if (this.status !== 'playing') return;
    const target = this.ghostY();
    this.score += (target - this.active.y) * 2;
    this.active.y = target;
    this.lock();
  }

  /** Swap the active piece with the held piece, once per piece. */
  hold() {
    if (this.status !== 'playing' || !this.canHold) return;
    const current = this.active.type;
    const swap = this.holdType || this.nextPieces.shift();
    this.holdType = current;
    this.canHold = false;
    this.spawn(swap);
  }

  /** Write the active piece into the board and resolve its effects. */
  lock() {
    const a = this.active;
    for (let y = 0; y < a.matrix.length; y += 1) {
      for (let x = 0; x < a.matrix.length; x += 1) {
        if (a.matrix[y][x] && a.y + y >= 0) this.rows[a.y + y].cells[a.x + x] = a.type;
      }
    }
    this.canHold = true;
    this.active = null;
    this.updateRowStates();
    const cleared = this.rows.filter((row) => matchesClue(row.clue, row.cells));
    if (cleared.length) {
      this.clearing = { rows: cleared, timer: FLASH_MS };
      this.status = 'clearing';
    } else {
      this.spawn(this.nextPieces.shift());
    }
  }

  /** Mark rows that are jammed or one cell away from their clue. */
  updateRowStates() {
    for (const row of this.rows) {
      const matched = matchesClue(row.clue, row.cells);
      row.jam = !matched && !canStillMatch(row.clue, row.cells);
      row.near = !matched && !row.jam && row.cells.some(Boolean) && isOneAway(row.clue, row.cells);
    }
  }

  /**
   * Count the jammed rows on the board.
   *
   * :return: number of jammed rows
   */
  jamCount() {
    return this.rows.filter((row) => row.jam).length;
  }

  /** Remove flashing rows, score them and bring in new clues. */
  finishClear() {
    const cleared = this.clearing.rows;
    const count = cleared.length;
    const points = CLEAR_POINTS[Math.min(count, 4)] * this.level;
    this.score += points;
    this.lines += count;
    this.bestClear = Math.max(this.bestClear, count);
    this.level = 1 + Math.floor(this.lines / ROWS_PER_LEVEL);
    this.banner = { text: CLEAR_NAMES[Math.min(count, 4)], points, timer: 900 };
    this.paintedRows += count;
    this.rows = this.rows.filter((row) => !cleared.includes(row));
    this.burnLowestJam();
    while (this.rows.length < ROWS) this.rows.unshift(this.newRow());
    this.clearing = null;
    this.updateRowStates();
    if (this.paintedRows >= PICTURE_ROWS) {
      this.completed = this.pictureFor(this.currentSequence);
      this.status = 'picture';
    } else {
      this.status = 'playing';
      this.spawn(this.nextPieces.shift());
    }
  }

  /** Remove the lowest jammed row. */
  burnLowestJam() {
    for (let y = this.rows.length - 1; y >= 0; y -= 1) {
      if (this.rows[y].jam) {
        this.rows.splice(y, 1);
        this.burned += 1;
        return;
      }
    }
  }

  /** Continue after the picture-complete screen. */
  nextPicture() {
    this.currentSequence += 1;
    this.paintedRows -= PICTURE_ROWS;
    this.completed = null;
    this.status = 'playing';
    this.spawn(this.nextPieces.shift());
  }

  /**
   * Get the time between automatic falls.
   *
   * :return: milliseconds per row
   */
  fallInterval() {
    const base = Math.max(90, 1000 * Math.pow(0.85, this.level - 1));
    return this.softDrop ? Math.min(40, base) : base;
  }

  /**
   * Advance the game clock.
   *
   * :param ms: elapsed milliseconds
   */
  update(ms) {
    if (this.banner) {
      this.banner.timer -= ms;
      if (this.banner.timer <= 0) this.banner = null;
    }
    if (this.status === 'clearing') {
      this.clearing.timer -= ms;
      if (this.clearing.timer <= 0) this.finishClear();
      return;
    }
    if (this.status !== 'playing') return;
    const a = this.active;
    if (this.collides(a.matrix, a.x, a.y + 1)) {
      this.lockTimer += ms;
      if (this.lockTimer >= LOCK_MS) this.lock();
      return;
    }
    this.lockTimer = 0;
    this.fallTimer += ms;
    const interval = this.fallInterval();
    while (this.fallTimer >= interval && !this.collides(a.matrix, a.x, a.y + 1)) {
      this.fallTimer -= interval;
      a.y += 1;
      if (this.softDrop) this.score += 1;
    }
  }
}

/* Let Node load this file for tests. Browsers skip this block. */
if (typeof module !== 'undefined') {
  module.exports = { COLS, ROWS, PICTURES, CLUE_LIMITS, maxClueRuns, runsOf, matchesClue, canStillMatch, isOneAway, Game };
}
