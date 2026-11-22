// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between five screens: title, play, paused, caught/timeout and win.
//
// ?seed=N fixes the run. ?shot=start|play|alarm|win (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_COIN, EVENT_EMP, EVENT_LASER, EVENT_PICKUP, EVENT_SMOKE, EVENT_SPOTTED, EVENT_STAR, EVENT_TIMEOUT, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TIMEOUT, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepSoundAt = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    input.takeClick();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Lift the Star of Meridian and reach the getaway door.');
  }

  function endRun(nextScreen, message) {
    screen = nextScreen;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(message);
  }

  function handleEvents(events) {
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_ALARM) audio.alarmTrip();
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_EMP) audio.emp();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_STAR) audio.star();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_CAUGHT) {
      audio.caught();
      endRun(SCREEN_OVER, `Caught. Score ${world.state.score}. Best ${best}.`);
    } else if (events & EVENT_WIN) {
      audio.win();
      endRun(SCREEN_WIN, `Clean getaway. Score ${world.state.score}. Best ${best}.`);
    } else if (events & EVENT_TIMEOUT) {
      audio.caught();
      endRun(SCREEN_TIMEOUT, `Dawn broke. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN || screen === SCREEN_TIMEOUT)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the room lives behind the title — guards patrol, cameras sweep.
      const idle = { dx: 0, dy: 0, sneak: false, grab: false, useTool: null, toolTarget: { x: 0, y: 0 } };
      world.step(idle);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    const toolKey = input.takeToolKey();
    const click = input.takeClick();
    const useTool = click ? 'coin' : toolKey;
    const toolTarget = click ? renderer.toWorld(click.x, click.y) : { x: 0, y: 0 };
    const events = world.step({
      dx: dir.dx,
      dy: dir.dy,
      sneak: input.sneak,
      grab: input.grab,
      useTool,
      toolTarget,
    });
    if (world.state.thief.moving && world.state.elapsed - stepSoundAt > 0.45) {
      stepSoundAt = world.state.elapsed;
      audio.step();
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A click on the title or end screens starts the game; in play it tosses a coin.
  canvas.addEventListener('mousedown', () => {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN || screen === SCREEN_TIMEOUT) {
      startGame();
    }
  });

  announce('The Meridian Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
