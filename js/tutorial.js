'use strict';

/* ---------- How-to-play demo ---------- */

const DEMO_CELL = 26;
const DEMO_CLUE_WIDTH = 70;
const DEMO_WIDTH = DEMO_CLUE_WIDTH + DEMO_CELL * COLS;
const DEMO_HEIGHT = DEMO_CELL * 4;
const DEMO_ROW_TOP = DEMO_CELL * 3;
const DEMO_START_MS = 700;
const DEMO_STEP_MS = 550;
const DEMO_FALL_MS = 250;
const DEMO_SHOW_MS = 600;
const DEMO_FLASH_MS = 350;
const DEMO_RESULT_MS = 2400;
const DEMO_TYPES = ['L', 'T', 'I', 'S'];

const DEMO_SCENES = [
  { clue: [3, 1], drops: [[2, 3, 4], [7]], text: 'The clue "3 1" asks for a run of 3, a gap, then a run of 1. Match it and the row clears.' },
  { clue: [3, 1], drops: [[0, 1, 2], [9]], text: 'The gaps can be any size, so this row matches "3 1" too.' },
  { clue: [3, 1], drops: [[0, 1, 2], [3]], text: 'A run of 4 can never fit "3 1", so the row becomes a jam. Every clear burns the lowest jam.' },
  { clue: [10], drops: [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]], text: 'A full row only clears when its clue is 10.' }
];

const demo = {
  canvas: document.getElementById('howtoCanvas'),
  caption: document.getElementById('howtoCaption'),
  step: document.getElementById('howtoStep'),
  scene: -1,
  start: 0
};
demo.canvas.width = DEMO_WIDTH * ratio;
demo.canvas.height = DEMO_HEIGHT * ratio;
demo.canvas.style.width = `${DEMO_WIDTH}px`;
demo.canvas.style.height = `${DEMO_HEIGHT}px`;

/**
 * Get how long a demo scene runs.
 *
 * :param scene: scene data
 * :return: milliseconds
 */
function sceneLength(scene) {
  return DEMO_START_MS + (scene.drops.length - 1) * DEMO_STEP_MS + DEMO_FALL_MS + DEMO_RESULT_MS;
}

/**
 * Draw the clue label for the demo row.
 *
 * :param c: canvas context
 * :param clue: array of run lengths
 * :param jam: true when the row is jammed
 */
function drawDemoClue(c, clue, jam) {
  let text = clue.join(' ');
  if (jam) {
    c.fillStyle = '#7a0f45';
    c.fillRect(0, DEMO_ROW_TOP, DEMO_CLUE_WIDTH - 6, DEMO_CELL - 2);
    text = `JAM ${text}`;
  }
  c.fillStyle = jam ? '#ffffff' : '#f0e6ff';
  c.font = '700 15px ui-monospace, Menlo, Consolas, monospace';
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  c.fillText(text, DEMO_CLUE_WIDTH - 12, DEMO_ROW_TOP + DEMO_CELL / 2);
}

/**
 * Draw one moment of a demo scene.
 *
 * :param scene: scene data
 * :param t: milliseconds since the scene started
 */
function drawDemo(scene, t) {
  const c = demo.canvas.getContext('2d');
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, DEMO_WIDTH, DEMO_HEIGHT);
  const cells = Array(COLS).fill(null);
  const falling = [];
  scene.drops.forEach((columns, i) => {
    const begin = DEMO_START_MS + i * DEMO_STEP_MS;
    const type = DEMO_TYPES[i % DEMO_TYPES.length];
    if (t >= begin + DEMO_FALL_MS) {
      columns.forEach((x) => { cells[x] = type; });
    } else if (t >= begin) {
      const y = DEMO_ROW_TOP * ((t - begin) / DEMO_FALL_MS);
      columns.forEach((x) => falling.push({ x, y, type }));
    }
  });
  const doneAt = DEMO_START_MS + (scene.drops.length - 1) * DEMO_STEP_MS + DEMO_FALL_MS;
  const done = t >= doneAt;
  const matched = done && matchesClue(scene.clue, cells);
  const jam = done && !matched && !canStillMatch(scene.clue, cells);
  const flashing = matched && t - doneAt >= DEMO_SHOW_MS;
  const cleared = matched && t - doneAt >= DEMO_SHOW_MS + DEMO_FLASH_MS;
  drawDemoClue(c, scene.clue, jam);
  cells.forEach((cell, x) => {
    const px = DEMO_CLUE_WIDTH + x * DEMO_CELL;
    if (!cell || cleared) {
      c.fillStyle = '#241044';
      c.fillRect(px, DEMO_ROW_TOP, DEMO_CELL - 2, DEMO_CELL - 2);
    } else if (flashing) {
      c.fillStyle = '#ffffff';
      c.fillRect(px, DEMO_ROW_TOP, DEMO_CELL - 2, DEMO_CELL - 2);
    } else if (jam) {
      drawJamBlock(c, px, DEMO_ROW_TOP, DEMO_CELL - 2);
    } else {
      drawBlock(c, px, DEMO_ROW_TOP, DEMO_CELL - 2, COLORS[cell]);
    }
  });
  falling.forEach((block) => {
    drawBlock(c, DEMO_CLUE_WIDTH + block.x * DEMO_CELL, block.y, DEMO_CELL - 2, COLORS[block.type]);
  });
  if (cleared || jam) {
    c.fillStyle = cleared ? '#19e3d6' : '#ff2e93';
    c.font = 'italic 700 22px Futura, "Avenir Next", "Century Gothic", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(cleared ? 'CLEAR' : 'JAM', DEMO_CLUE_WIDTH + (DEMO_CELL * COLS) / 2, DEMO_CELL * 1.5);
  }
}

/**
 * Advance the demo while it is on screen, and restart it when hidden.
 *
 * :param now: current time in milliseconds
 */
function demoFrame(now) {
  if (demo.canvas.offsetParent === null) {
    demo.scene = -1;
  } else {
    if (demo.scene < 0 || now - demo.start >= sceneLength(DEMO_SCENES[demo.scene])) {
      demo.scene = (demo.scene + 1) % DEMO_SCENES.length;
      demo.start = now;
      demo.caption.textContent = DEMO_SCENES[demo.scene].text;
      demo.step.textContent = `${demo.scene + 1} / ${DEMO_SCENES.length}`;
    }
    drawDemo(DEMO_SCENES[demo.scene], now - demo.start);
  }
  requestAnimationFrame(demoFrame);
}

requestAnimationFrame(demoFrame);
