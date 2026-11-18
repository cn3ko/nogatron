'use strict';

/* ---------- Drawing ---------- */

const CELL = 40;
const CLUE_WIDTH = 104;
const boardCanvas = document.getElementById('board');
const ratio = window.devicePixelRatio || 1;
boardCanvas.width = (CLUE_WIDTH + CELL * COLS) * ratio;
boardCanvas.height = CELL * ROWS * ratio;
boardCanvas.style.width = `${CLUE_WIDTH + CELL * COLS}px`;
boardCanvas.style.height = `${CELL * ROWS}px`;
const ctx = boardCanvas.getContext('2d');

/**
 * Draw a shaded block.
 *
 * :param c: canvas context
 * :param x: left position
 * :param y: top position
 * :param size: width and height
 * :param color: fill color
 */
function drawBlock(c, x, y, size, color) {
  c.fillStyle = color;
  c.fillRect(x, y, size, size);
  c.fillStyle = 'rgba(255, 255, 255, .3)';
  c.fillRect(x, y, size, 2);
  c.fillStyle = 'rgba(0, 0, 0, .28)';
  c.fillRect(x, y + size - 3, size, 3);
}

/**
 * Draw the striped block used for a jammed row.
 *
 * :param c: canvas context
 * :param x: left position
 * :param y: top position
 * :param size: width and height
 */
function drawJamBlock(c, x, y, size) {
  c.save();
  c.beginPath();
  c.rect(x, y, size, size);
  c.clip();
  c.fillStyle = '#3b2a55';
  c.fillRect(x, y, size, size);
  c.strokeStyle = '#6f5a92';
  c.lineWidth = 5;
  for (let i = -size; i < size; i += 12) {
    c.beginPath();
    c.moveTo(x + i, y + size);
    c.lineTo(x + i + size, y);
    c.stroke();
  }
  c.restore();
}

/**
 * Draw one row's clue label.
 *
 * :param row: row object
 * :param y: board row number
 * :param flashing: true when the row is being cleared
 */
function drawClue(row, y, flashing) {
  const top = y * CELL;
  let fill = null;
  let color = '#f0e6ff';
  let text = row.clue.join(' ');
  if (flashing) {
    fill = '#ffffff';
    color = '#12071f';
  } else if (row.jam) {
    fill = '#7a0f45';
    color = '#ffffff';
    text = `JAM ${text}`;
  } else if (row.near) {
    fill = '#19e3d6';
    color = '#12071f';
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, top, CLUE_WIDTH - 8, CELL - 2);
  }
  ctx.fillStyle = color;
  const size = text.length > 9 ? 13 : 17;
  ctx.font = `700 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CLUE_WIDTH - 18, top + CELL / 2);
}

/**
 * Draw the active piece and its landing preview.
 *
 * :param game: current game
 */
function drawActive(game) {
  const a = game.active;
  if (!a) return;
  const ghost = game.ghostY();
  const color = COLORS[a.type];
  a.matrix.forEach((row, y) => row.forEach((filled, x) => {
    if (!filled) return;
    const px = CLUE_WIDTH + (a.x + x) * CELL;
    if (ghost + y >= 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, (ghost + y) * CELL + 1, CELL - 4, CELL - 4);
    }
  }));
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  a.matrix.forEach((row, y) => row.forEach((filled, x) => {
    if (filled && a.y + y >= 0) {
      drawBlock(ctx, CLUE_WIDTH + (a.x + x) * CELL, (a.y + y) * CELL, CELL - 2, color);
    }
  }));
  ctx.restore();
}

/**
 * Draw the whole board, including clues and the clear banner.
 *
 * :param game: current game
 */
function drawBoard(game) {
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, CLUE_WIDTH + CELL * COLS, CELL * ROWS);
  const flashingRows = game.clearing ? game.clearing.rows : [];
  game.rows.forEach((row, y) => {
    const flashing = flashingRows.includes(row);
    drawClue(row, y, flashing);
    row.cells.forEach((cell, x) => {
      const px = CLUE_WIDTH + x * CELL;
      const py = y * CELL;
      if (flashing && cell) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, py, CELL - 2, CELL - 2);
      } else if (!cell) {
        ctx.fillStyle = y < 3 ? '#4f1240' : '#241044';
        ctx.fillRect(px, py, CELL - 2, CELL - 2);
      } else if (row.jam) {
        drawJamBlock(ctx, px, py, CELL - 2);
      } else {
        drawBlock(ctx, px, py, CELL - 2, COLORS[cell]);
      }
    });
  });
  drawActive(game);
  if (game.banner) {
    const middle = CLUE_WIDTH + (CELL * COLS) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = '#ff2e93';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffe6f4';
    ctx.font = 'italic 700 56px Futura, "Avenir Next", "Century Gothic", sans-serif';
    ctx.fillText(game.banner.text, middle, 190);
    ctx.restore();
    ctx.fillStyle = '#19e3d6';
    ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText(`+${game.banner.points}`, middle, 236);
  }
}

/**
 * Draw a small preview of a piece.
 *
 * :param c: canvas context
 * :param type: piece letter
 * :param top: top position in the canvas
 */
function drawMiniPiece(c, type, top) {
  const size = 22;
  const matrix = shapeMatrix(type);
  const rows = matrix.filter((row) => row.some(Boolean));
  rows.forEach((row, y) => row.forEach((filled, x) => {
    if (filled) drawBlock(c, x * (size + 2), top + y * (size + 2), size, COLORS[type]);
  }));
}

/**
 * Draw the hold and next panels.
 *
 * :param game: current game
 */
function drawPreviews(game) {
  const holdCtx = document.getElementById('hold').getContext('2d');
  holdCtx.clearRect(0, 0, 96, 48);
  if (game.holdType) drawMiniPiece(holdCtx, game.holdType, 0);
  const nextCtx = document.getElementById('next').getContext('2d');
  nextCtx.clearRect(0, 0, 96, 168);
  game.nextPieces.slice(0, 3).forEach((type, i) => drawMiniPiece(nextCtx, type, i * 60));
}

/**
 * Draw a picture with only some of its rows revealed.
 *
 * :param canvas: target canvas
 * :param picture: picture data
 * :param painted: set of revealed row numbers
 */
function drawPicture(canvas, picture, painted) {
  const c = canvas.getContext('2d');
  const size = canvas.width / 10;
  c.clearRect(0, 0, canvas.width, canvas.height);
  picture.rows.forEach((text, y) => [...text].forEach((ch, x) => {
    if (!painted.has(y)) c.fillStyle = '#2e1a4a';
    else c.fillStyle = ch === '#' ? picture.color : '#12071f';
    c.fillRect(x * size, y * size, size - 1, size - 1);
  }));
}

/* ---------- Page and input ---------- */

const game = new Game();
const elements = {
  overlay: document.getElementById('overlay'),
  title: document.getElementById('overlayTitle'),
  body: document.getElementById('overlayBody'),
  button: document.getElementById('overlayButton'),
  picture: document.getElementById('overlayPicture')
};
const BEST_KEY = 'nogatron-best-score';
let bestScore = loadBest();
let shownStatus = null;
let overlayShownAt = 0;
const OVERLAY_GUARD_MS = 600;

/**
 * Read the saved best score.
 *
 * :return: best score, or 0 when none can be read
 */
function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Save the best score when the browser allows it.
 *
 * :param value: score to save
 */
function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    /* Saving is optional, so the game carries on without it. */
  }
}

/**
 * Show the overlay with a title, text and button.
 *
 * :param title: heading text
 * :param bodyHtml: fixed HTML for the body
 * :param buttonText: button label
 * :param picture: optional picture to reveal
 */
function showOverlay(title, bodyHtml, buttonText, picture) {
  elements.title.textContent = title;
  elements.body.innerHTML = bodyHtml;
  elements.button.textContent = buttonText;
  elements.picture.hidden = !picture;
  if (picture) {
    drawPicture(elements.picture, picture, new Set(picture.rows.map((_, y) => y)));
  }
  elements.overlay.hidden = false;
  overlayShownAt = performance.now();
  elements.button.focus();
}

/** Update the overlay when the game status changes. */
function syncOverlay() {
  if (game.status === shownStatus) return;
  shownStatus = game.status;
  document.getElementById('howto').hidden = game.status !== 'ready' && game.status !== 'paused';
  if (game.status === 'ready') {
    showOverlay('Nogatron', '<p>Each cleared row reveals one more row of a hidden picture. The game ends when the stack reaches the top.</p>', 'Start');
  } else if (game.status === 'paused') {
    showOverlay('Paused', '', 'Resume');
  } else if (game.status === 'picture') {
    showOverlay(game.completed.name, '<p>Picture complete.</p>', 'Next picture', game.completed);
  } else if (game.status === 'over') {
    showOverlay('Game over', `<p>Score ${game.score}. Rows ${game.lines}. Jams burned ${game.burned}.</p>`, 'Play again');
  } else {
    elements.overlay.hidden = true;
  }
}

/** Run the action offered by the overlay button. */
function overlayAction() {
  if (performance.now() - overlayShownAt < OVERLAY_GUARD_MS) return;
  if (game.status === 'ready' || game.status === 'paused') {
    game.status = 'playing';
  } else if (game.status === 'picture') {
    game.nextPicture();
  } else if (game.status === 'over') {
    game.reset();
    game.status = 'playing';
  }
}

/** Update the numbers and panels beside the board. */
function drawPanels() {
  if (game.score > bestScore) {
    bestScore = game.score;
    saveBest(bestScore);
  }
  document.getElementById('score').textContent = game.score.toLocaleString('en-US');
  document.getElementById('best').textContent = bestScore.toLocaleString('en-US');
  document.getElementById('level').textContent = game.level;
  document.getElementById('lines').textContent = game.lines;
  const jams = document.getElementById('jams');
  const jamCount = game.jamCount();
  jams.textContent = jamCount;
  jams.classList.toggle('alert', jamCount > 0);
  const shown = Math.min(game.paintedRows, PICTURE_ROWS);
  const painted = new Set(Array.from({ length: shown }, (_, y) => y));
  document.getElementById('pictureCount').textContent = `${shown} / ${PICTURE_ROWS}`;
  drawPicture(document.getElementById('picture'), game.pictureFor(game.currentSequence), painted);
  drawPreviews(game);
}

const heldMove = { direction: 0, timer: 0 };
const REPEAT_DELAY_MS = 170;
const REPEAT_RATE_MS = 50;

/**
 * Repeat sideways movement while a direction key is held.
 *
 * :param ms: elapsed milliseconds
 */
function updateHeldMove(ms) {
  if (!heldMove.direction) return;
  heldMove.timer -= ms;
  while (heldMove.timer <= 0) {
    game.move(heldMove.direction);
    heldMove.timer += REPEAT_RATE_MS;
  }
}

/**
 * Handle a key being pressed.
 *
 * :param event: keyboard event
 */
function onKeyDown(event) {
  const key = event.code;
  const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(key);
  if (handled && document.activeElement !== elements.button) event.preventDefault();
  if (event.repeat) return;
  if (game.status !== 'playing' && game.status !== 'clearing') {
    if (key === 'KeyP' && game.status === 'paused') overlayAction();
    if (key === 'KeyR') restart();
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const direction = key === 'ArrowLeft' ? -1 : 1;
    game.move(direction);
    heldMove.direction = direction;
    heldMove.timer = REPEAT_DELAY_MS;
  } else if (key === 'ArrowUp' || key === 'KeyX') {
    game.rotate(1);
  } else if (key === 'KeyZ') {
    game.rotate(-1);
  } else if (key === 'ArrowDown') {
    game.softDrop = true;
  } else if (key === 'Space') {
    game.hardDrop();
  } else if (key === 'KeyC') {
    game.hold();
  } else if (key === 'KeyP' && game.status === 'playing') {
    game.status = 'paused';
  } else if (key === 'KeyR') {
    restart();
  }
}

/**
 * Handle a key being released.
 *
 * :param event: keyboard event
 */
function onKeyUp(event) {
  const released = { ArrowLeft: -1, ArrowRight: 1 }[event.code];
  if (released && heldMove.direction === released) heldMove.direction = 0;
  if (event.code === 'ArrowDown') game.softDrop = false;
}

/** Start a new game straight away. */
function restart() {
  game.reset();
  game.status = 'playing';
  heldMove.direction = 0;
}

let lastTime = performance.now();

/**
 * Advance and draw one frame.
 *
 * :param now: current time in milliseconds
 */
function frame(now) {
  const ms = Math.min(now - lastTime, 100);
  lastTime = now;
  updateHeldMove(ms);
  game.update(ms);
  syncOverlay();
  drawBoard(game);
  drawPanels();
  requestAnimationFrame(frame);
}

elements.button.addEventListener('click', overlayAction);
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', () => {
  heldMove.direction = 0;
  game.softDrop = false;
  if (game.status === 'playing') game.status = 'paused';
});
requestAnimationFrame(frame);
