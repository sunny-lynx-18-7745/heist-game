// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred. Flat shapes, glows and canvas text:
// marble floor, carpet runner, glass cases, sweeping cones, the glowing Star, and the HUD
// with its alarm meter, timer, loot and tools.

import {
  ALARM, CAMERA, FIELD, FONT, GUARD, HUD_HEIGHT, LASER, PALETTE, ROOM, THIEF, TOOLS,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_TIMEOUT = 'timeout';

const TILE = 80;

function alarmColor(value) {
  if (value < 40) return PALETTE.alarmLow;
  if (value < 75) return PALETTE.alarmMid;
  return PALETTE.alarmHigh;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Canvas CSS pixels (mouse) back to playfield coordinates. */
  function toWorld(px, py) {
    return {
      x: (px * view.ratio - view.x) / view.scale,
      y: (py * view.ratio - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function drawCone(x, y, heading, halfAngle, range, fill, edge) {
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, heading - halfAngle, heading + halfAngle);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawFloor(state) {
    // Marble tiles.
    for (let ty = 0; ty < ROOM.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, ROOM.height);
      context.stroke();
    }
    for (let y = 0; y <= ROOM.height; y += TILE) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    // The red carpet runner up the middle, from the doors to the Star.
    const carpet = state.level.carpet;
    context.fillStyle = PALETTE.carpet;
    context.fillRect(carpet.x, carpet.y, carpet.w, carpet.h);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 3;
    context.strokeRect(carpet.x, carpet.y, carpet.w, carpet.h);

    // Walls, with a lighter top edge.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 20);
    context.fillRect(0, ROOM.height - 20, FIELD.width, 20);
    context.fillRect(0, 0, 20, ROOM.height);
    context.fillRect(FIELD.width - 20, 0, 20, ROOM.height);
    context.fillStyle = PALETTE.wallTop;
    context.fillRect(0, 0, FIELD.width, 4);
    context.fillRect(0, ROOM.height - 4, FIELD.width, 4);
    context.fillRect(0, 0, 4, ROOM.height);
    context.fillRect(FIELD.width - 4, 0, 4, ROOM.height);

    // Entry door (service door, bottom left) and getaway door (bottom right).
    context.fillStyle = '#10131d';
    context.fillRect(64, ROOM.height - 20, 56, 20);
    context.fillStyle = PALETTE.exit;
    context.fillRect(1160, ROOM.height - 20, 56, 20);
    text('IN', 92, ROOM.height - 26, 13, PALETTE.muted, 'center');
    text('GETAWAY', 1188, ROOM.height - 26, 13, PALETTE.exit, 'center');
  }

  function drawObstacles(state) {
    for (const o of state.level.obstacles) {
      if (o.kind === 'case') {
        context.fillStyle = PALETTE.caseGold;
        context.fillRect(o.x - 3, o.y - 3, o.w + 6, o.h + 6);
        context.fillStyle = PALETTE.caseGlass;
        context.fillRect(o.x, o.y, o.w, o.h);
        context.fillStyle = 'rgba(255,255,255,0.10)';
        context.fillRect(o.x + 6, o.y + 6, o.w - 12, 14);
        text(o.label, o.x + o.w / 2, o.y + o.h / 2 + 5, 13, '#cfe0f2', 'center');
      } else if (o.kind === 'pillar') {
        context.fillStyle = PALETTE.pillar;
        context.beginPath();
        context.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = PALETTE.wallTop;
        context.lineWidth = 2;
        context.stroke();
      } else if (o.kind === 'plant') {
        context.fillStyle = PALETTE.plant;
        context.beginPath();
        context.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2 - 2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#3f7d58';
        context.beginPath();
        context.arc(o.x + o.w / 2 - 8, o.y + o.h / 2 - 6, 10, 0, Math.PI * 2);
        context.arc(o.x + o.w / 2 + 9, o.y + o.h / 2 + 4, 9, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = '#4a3423';
        context.fillRect(o.x, o.y, o.w, o.h);
        context.fillStyle = '#6b4c31';
        context.fillRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8);
      }
    }
  }

  function drawLasers(state) {
    const lz = state.level.lasers;
    const on = state.laserOn;
    for (let x = lz.x0; x <= lz.x1; x += LASER.beamGap) {
      context.strokeStyle = on ? PALETTE.laser : PALETTE.laserOff;
      context.lineWidth = on ? 3 : 1.5;
      context.beginPath();
      context.moveTo(x, lz.y0);
      context.lineTo(x, lz.y1);
      context.stroke();
      context.fillStyle = on ? '#ff6b6b' : '#5a2b2b';
      context.beginPath();
      context.arc(x, lz.y0, 4, 0, Math.PI * 2);
      context.arc(x, lz.y1, 4, 0, Math.PI * 2);
      context.fill();
    }
    text(on ? 'LASER GRID — LIVE' : 'LASER GRID — OFF', (lz.x0 + lz.x1) / 2, lz.y0 - 8, 12, on ? '#ff8a8a' : PALETTE.muted, 'center');
  }

  function drawLoot(state) {
    const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 3);
    const star = state.level.star;
    if (!state.starTaken) {
      context.fillStyle = `rgba(255, 217, 77, ${0.25 * pulse})`;
      context.beginPath();
      context.arc(star.x, star.y, 46 * pulse, 0, Math.PI * 2);
      context.fill();
      // Pedestal and glass case.
      context.fillStyle = PALETTE.caseGold;
      context.fillRect(star.x - 26, star.y + 8, 52, 30);
      context.fillStyle = 'rgba(120, 170, 210, 0.35)';
      context.beginPath();
      context.arc(star.x, star.y, star.r + 10, 0, Math.PI * 2);
      context.fill();
      // The Star of Meridian: a faceted gem.
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.moveTo(star.x, star.y - 16);
      context.lineTo(star.x + 13, star.y - 2);
      context.lineTo(star.x + 7, star.y + 13);
      context.lineTo(star.x - 7, star.y + 13);
      context.lineTo(star.x - 13, star.y - 2);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff6c9';
      context.beginPath();
      context.moveTo(star.x, star.y - 16);
      context.lineTo(star.x + 13, star.y - 2);
      context.lineTo(star.x, star.y - 2);
      context.closePath();
      context.fill();
      text('THE STAR OF MERIDIAN', star.x, star.y - 34, 14, PALETTE.loot, 'center');
    }
    for (const art of state.level.artefacts) {
      if (art.taken) continue;
      context.fillStyle = PALETTE.lootGlow;
      context.beginPath();
      context.arc(art.x, art.y, 26 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#8fd6ff';
      context.beginPath();
      context.arc(art.x, art.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.caseGold;
      context.fillRect(art.x - 14, art.y + 10, 28, 8);
      text(art.name.toUpperCase(), art.x, art.y - 22, 11, '#cfe0f2', 'center');
    }
  }

  function drawSmoke(state) {
    for (const cloud of state.tools.smokeClouds) {
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(220,225,240,0.35)';
      context.beginPath();
      context.arc(cloud.x - 24, cloud.y - 12, cloud.r * 0.55, 0, Math.PI * 2);
      context.arc(cloud.x + 26, cloud.y + 14, cloud.r * 0.5, 0, Math.PI * 2);
      context.fill();
    }
    if (state.coinSpot) {
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(state.coinSpot.x, state.coinSpot.y, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255, 217, 77, 0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(state.coinSpot.x, state.coinSpot.y, 10 + 6 * Math.sin(state.elapsed * 6), 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const fill = guard.mode === 'chase'
        ? 'rgba(217, 68, 68, 0.30)'
        : PALETTE.coneGuard;
      const edge = guard.mode === 'chase' ? 'rgba(255, 90, 90, 0.8)' : PALETTE.coneGuardEdge;
      drawCone(guard.x, guard.y, guard.heading, GUARD.viewHalfAngle, GUARD.viewRange, fill, edge);
      // Patrol path, faint, so the player can read the route.
      context.strokeStyle = 'rgba(201, 79, 67, 0.25)';
      context.lineWidth = 2;
      context.setLineDash([6, 6]);
      context.beginPath();
      const wps = state.level.guards.find((g) => g.id === guard.id).waypoints;
      context.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i += 1) context.lineTo(wps[i].x, wps[i].y);
      context.closePath();
      context.stroke();
      context.setLineDash([]);
      // Body: red uniform, darker when chasing.
      context.fillStyle = guard.mode === 'chase' ? '#ff5a4d' : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardDark;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.heading) * 6, guard.y + Math.sin(guard.heading) * 6, 7, 0, Math.PI * 2);
      context.fill();
      // Detection ring above the guard's head.
      if (guard.detection > 0.05) {
        context.strokeStyle = guard.detection > GUARD.suspiciousAt ? '#ff5a4d' : PALETTE.gold;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(guard.x, guard.y, GUARD.radius + 7, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
        context.stroke();
      }
      const mark = guard.mode === 'chase' ? '!' : guard.mode === 'investigate' ? '?' : '';
      if (mark) text(mark, guard.x, guard.y - GUARD.radius - 12, 22, mark === '!' ? '#ff5a4d' : PALETTE.gold, 'center');
      text(guard.name.toUpperCase(), guard.x, guard.y + GUARD.radius + 16, 10, PALETTE.muted, 'center');
    }
  }

  function drawCameras(state) {
    for (const cam of state.cameras) {
      if (!cam.disabled) {
        drawCone(cam.x, cam.y, cam.angle, CAMERA.viewHalfAngle, CAMERA.viewRange, PALETTE.coneCamera, PALETTE.coneCameraEdge);
      }
      // Wall mount and lens.
      context.fillStyle = '#3a4360';
      context.fillRect(cam.x - 10, cam.y - 6, 20, 12);
      context.fillStyle = cam.disabled ? '#555f7d' : PALETTE.camera;
      context.beginPath();
      context.arc(cam.x + Math.cos(cam.angle) * 12, cam.y + Math.sin(cam.angle) * 12, 7, 0, Math.PI * 2);
      context.fill();
      if (cam.disabled) {
        text('EMP', cam.x, cam.y - 18, 11, '#8b93a3', 'center');
      } else if (cam.detection > 0.05) {
        context.strokeStyle = '#ff5a4d';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(cam.x, cam.y, 20, -Math.PI / 2, -Math.PI / 2 + cam.detection * Math.PI * 2);
        context.stroke();
      }
      text(cam.name, cam.x, cam.y + 26, 10, PALETTE.muted, 'center');
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const blink = thief.grabbing ? 1 : 1;
    if (blink) {
      // A soft halo so the eye finds the thief at a glance.
      context.fillStyle = 'rgba(238, 228, 216, 0.16)';
      context.beginPath();
      context.arc(thief.x, thief.y, THIEF.radius + 8, 0, Math.PI * 2);
      context.fill();
      // Soft shadow and the thief: a hooded figure in a pale coat.
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(thief.x + 2, thief.y + 4, THIEF.radius, THIEF.radius * 0.7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.thief;
      context.beginPath();
      context.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.thiefCoat;
      context.beginPath();
      context.arc(thief.x + Math.cos(thief.heading) * 5, thief.y + Math.sin(thief.heading) * 5, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.thief;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(thief.x, thief.y);
      context.lineTo(thief.x + Math.cos(thief.heading) * (THIEF.radius + 6), thief.y + Math.sin(thief.heading) * (THIEF.radius + 6));
      context.stroke();
      if (thief.sneaking) text('SNEAKING', thief.x, thief.y - THIEF.radius - 10, 10, PALETTE.muted, 'center');
      if (thief.grabbing) {
        context.strokeStyle = PALETTE.loot;
        context.lineWidth = 5;
        context.beginPath();
        context.arc(thief.x, thief.y, THIEF.radius + 9, -Math.PI / 2, -Math.PI / 2 + thief.grabProgress * Math.PI * 2);
        context.stroke();
        text('LIFTING…', thief.x, thief.y - THIEF.radius - 10, 11, PALETTE.loot, 'center');
      }
    }
  }

  function drawExit(state) {
    const e = state.level.exit;
    const glow = state.starTaken ? 0.5 + 0.3 * Math.sin(state.elapsed * 4) : 0.2;
    context.fillStyle = `rgba(63, 158, 107, ${glow})`;
    context.fillRect(e.x - e.w / 2 - 8, e.y - e.h / 2 - 8, e.w + 16, e.h + 16);
    context.fillStyle = PALETTE.exit;
    context.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
    text('EXIT', e.x, e.y + 5, 13, '#eafff3', 'center');
    if (state.starTaken) {
      context.strokeStyle = `rgba(63, 158, 107, ${glow})`;
      context.lineWidth = 3;
      context.strokeRect(e.x - e.w / 2 - 8, e.y - e.h / 2 - 8, e.w + 16, e.h + 16);
    }
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(8, 10, 18, 0.92)';
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, HUD_HEIGHT, FIELD.width, 1);

    // Alarm meter: the big one, left.
    const alarmW = 300;
    const alarmX = 24;
    const alarmY = 16;
    text('ALARM', alarmX, alarmY + 9, 13, state.alarmTripped ? '#ff5a4d' : PALETTE.muted, 'left');
    context.fillStyle = '#1c2233';
    context.fillRect(alarmX + 62, alarmY, alarmW, 20);
    context.fillStyle = alarmColor(state.alarm);
    context.fillRect(alarmX + 62, alarmY, (alarmW * state.alarm) / ALARM.max, 20);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(alarmX + 62, alarmY, alarmW, 20);
    const pct = `${Math.round(state.alarm)}%`;
    text(pct, alarmX + 62 + alarmW + 10, alarmY + 16, 15, alarmColor(state.alarm), 'left');
    if (state.alarmTripped) {
      const flash = Math.sin(state.elapsed * 8) > 0;
      text('!! ALARM TRIPPED !!', alarmX + 62, alarmY + 38, 13, flash ? '#ff5a4d' : PALETTE.gold, 'left');
    } else {
      text(state.seenNow ? 'SPOTTED — break line of sight!' : 'Unseen', alarmX + 62, alarmY + 38, 12, state.seenNow ? '#ff8a8a' : PALETTE.muted, 'left');
    }

    // Timer and score, centre.
    text(formatTime(state.timeLeft), FIELD.width / 2 - 130, 34, 26, state.timeLeft < 30 ? '#ff5a4d' : PALETTE.text, 'center');
    text(`SCORE ${state.score}`, FIELD.width / 2 + 40, 30, 18, PALETTE.text, 'center');

    // Loot: star + artefacts, between the score and the tools.
    const lootX = 800;
    text('LOOT', lootX, 22, 12, PALETTE.muted, 'left');
    context.fillStyle = state.starTaken ? PALETTE.loot : '#3a3f52';
    context.beginPath();
    context.moveTo(lootX + 52, 14);
    context.lineTo(lootX + 60, 22);
    context.lineTo(lootX + 56, 32);
    context.lineTo(lootX + 48, 32);
    context.lineTo(lootX + 44, 22);
    context.closePath();
    context.fill();
    let taken = 0;
    for (const art of state.level.artefacts) if (art.taken) taken += 1;
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < taken ? '#8fd6ff' : '#3a3f52';
      context.beginPath();
      context.arc(lootX + 78 + i * 22, 23, 7, 0, Math.PI * 2);
      context.fill();
    }

    // Tools, right.
    const tools = state.tools;
    const toolDefs = [
      { key: '1', name: 'SMOKE', count: tools.smoke },
      { key: '2', name: 'EMP', count: tools.emp },
      { key: '3', name: 'COIN', count: tools.coin },
    ];
    let tx = FIELD.width - 24;
    for (let i = toolDefs.length - 1; i >= 0; i -= 1) {
      const t = toolDefs[i];
      const label = `[${t.key}] ${t.name} ×${t.count}`;
      const w = 92;
      tx -= w;
      context.fillStyle = t.count > 0 ? '#232a3d' : '#171a26';
      context.fillRect(tx, 12, w - 8, 32);
      context.strokeStyle = PALETTE.panelEdge;
      context.strokeRect(tx, 12, w - 8, 32);
      text(label, tx + (w - 8) / 2, 33, 12, t.count > 0 ? PALETTE.text : PALETTE.muted, 'center');
    }

    // Objective line under the HUD.
    const objective = state.starTaken
      ? '★ Star secured — reach the GETAWAY door, bottom right!'
      : 'Lift the Star of Meridian — hold SPACE beside it. Artefacts are bonus loot.';
    text(objective, FIELD.width / 2, HUD_HEIGHT + 22, 14, state.starTaken ? PALETTE.exit : PALETTE.gold, 'center');

    // Toast message.
    if (state.messageLeft > 0 && state.message) {
      context.fillStyle = PALETTE.panel;
      const w = 560;
      context.fillRect((FIELD.width - w) / 2, FIELD.height - 64, w, 36);
      context.strokeStyle = PALETTE.panelEdge;
      context.strokeRect((FIELD.width - w) / 2, FIELD.height - 64, w, 36);
      text(state.message, FIELD.width / 2, FIELD.height - 40, 15, PALETTE.text, 'center');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 170 + lines.length * 30;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 64, 44, accent || PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 112 + i * 30, 19, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'One room. Three guards. Three cameras. One Star.',
    'WASD / arrows to move · Shift to sneak · Space to lift loot',
    '1 smoke · 2 EMP · 3 coin (or click) · P pause · M mute',
    'Cross the lasers when they flicker off. Mind the cones.',
  ];

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // The HUD sits at the top of the playfield; the room draws beneath it.
    context.save();
    context.translate(0, HUD_HEIGHT);
    drawFloor(state);
    drawObstacles(state);
    drawLasers(state);
    drawLoot(state);
    drawExit(state);
    drawSmoke(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    context.restore();
    drawHud(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('THE MERIDIAN VAULT', TITLE_LINES, `Press Space or click to start   ·   Best ${best}`, PALETTE.gold);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED!', [`Score ${state.score}`, `Best ${best}`, 'The guards dragged you out in cuffs.'], 'Press Space to try again', '#ff5a4d');
    } else if (screen === SCREEN_WIN) {
      const b = state.winBreakdown || { timeBonus: 0, alarmPenalty: 0, toolBonus: 0 };
      drawPanel('CLEAN GETAWAY!', [
        `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
        `Time bonus +${b.timeBonus} · Alarm penalty −${b.alarmPenalty} · Spare tools +${b.toolBonus}`,
        'The Star of Meridian is gone, and so are you.',
      ], 'Press Space to run it again', PALETTE.exit);
    } else if (screen === SCREEN_TIMEOUT) {
      drawPanel('DAWN BREAKS', [`Score ${state.score}`, `Best ${best}`, 'The museum opens. The crew left without you.'], 'Press Space to try again', '#ff8a5a');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld };
}
