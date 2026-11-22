// Keyboard and mouse, read fresh every frame. WASD or arrows move, Shift sneaks, Space or E
// grabs loot, 1/2/3 spend a tool, a mouse click tosses a coin at the cursor, P pauses, M mutes.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let toolKey = null;
  let click = null;
  let mouse = { x: 0, y: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    }
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit1') toolKey = 'smoke';
    if (event.code === 'Digit2') toolKey = 'emp';
    if (event.code === 'Digit3') toolKey = 'coin';
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  /** The movement vector this frame, from the keys held down. */
  function direction() {
    let dx = 0;
    let dy = 0;
    for (const code of held) {
      const move = MOVE_KEYS[code];
      if (move) {
        dx += move[0];
        dy += move[1];
      }
    }
    return { dx, dy };
  }

  return {
    direction,
    get sneak() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    get grab() {
      return held.has('Space') || held.has('KeyE');
    },
    get mouse() {
      return mouse;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeToolKey() {
      const taken = toolKey;
      toolKey = null;
      return taken;
    },
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
