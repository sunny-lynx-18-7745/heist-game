// The Meridian Vault's one room: walls, display cases, pillars and plants to hide behind,
// the Star of Meridian in its case at the top, three side artefacts, three patrolling guards,
// three sweeping cameras and the laser grid in front of the Star. Three ways across the room:
// the west wing, the east wing, or straight up the middle through the lasers.

export const WALL = 20;

/** Rectangles are {x, y, w, h}; circles are {x, y, r}. */
export function buildLevel() {
  const obstacles = [
    // Tall display cases: block movement and block sight.
    { kind: 'case', x: 170, y: 170, w: 150, h: 70, blocksSight: true, label: 'Porcelain Wing' },
    { kind: 'case', x: 960, y: 170, w: 150, h: 70, blocksSight: true, label: 'Jade Wing' },
    { kind: 'case', x: 520, y: 380, w: 240, h: 64, blocksSight: true, label: 'Grand Case' },
    // Stone pillars: block movement and sight.
    { kind: 'pillar', x: 300, y: 420, w: 44, h: 44, blocksSight: true },
    { kind: 'pillar', x: 300, y: 540, w: 44, h: 44, blocksSight: true },
    { kind: 'pillar', x: 936, y: 420, w: 44, h: 44, blocksSight: true },
    { kind: 'pillar', x: 936, y: 540, w: 44, h: 44, blocksSight: true },
    // Low planters and benches: block movement, but a guard can see over them.
    { kind: 'plant', x: 430, y: 150, w: 52, h: 52, blocksSight: false },
    { kind: 'plant', x: 798, y: 150, w: 52, h: 52, blocksSight: false },
    { kind: 'bench', x: 560, y: 560, w: 160, h: 34, blocksSight: false },
  ];

  return {
    entry: { x: 92, y: 648 },
    exit: { x: 1188, y: 648, w: 56, h: 44 },
    star: { x: 640, y: 96, r: 20 },
    artefacts: [
      { id: 'falcon', name: 'Jade Falcon', x: 150, y: 330, r: 14, taken: false },
      { id: 'mask', name: 'Ivory Mask', x: 1130, y: 330, r: 14, taken: false },
      { id: 'ledger', name: 'Emerald Ledger', x: 640, y: 500, r: 14, taken: false },
    ],
    obstacles,
    guards: [
      {
        id: 'rook', name: 'Rook',
        waypoints: [
          { x: 300, y: 280 }, { x: 300, y: 480 }, { x: 460, y: 480 }, { x: 460, y: 280 },
        ],
      },
      {
        id: 'bishop', name: 'Bishop',
        waypoints: [
          { x: 980, y: 280 }, { x: 980, y: 480 }, { x: 820, y: 480 }, { x: 820, y: 280 },
        ],
      },
      {
        id: 'knight', name: 'Knight',
        waypoints: [
          { x: 520, y: 290 }, { x: 760, y: 290 }, { x: 760, y: 480 }, { x: 520, y: 480 },
        ],
      },
    ],
    cameras: [
      { id: 'cam-a', name: 'CAM A', x: 56, y: 56, baseAngle: Math.PI / 4, mount: 'corner' },
      { id: 'cam-b', name: 'CAM B', x: 1224, y: 56, baseAngle: (3 * Math.PI) / 4, mount: 'corner' },
      { id: 'cam-c', name: 'CAM C', x: 640, y: 688, baseAngle: -Math.PI / 2, mount: 'wall' },
    ],
    /** The laser grid guarding the Star: vertical beams across the middle corridor. */
    lasers: { x0: 480, x1: 800, y0: 148, y1: 196 },
    carpet: { x: 480, y: 210, w: 320, h: 420 },
  };
}

/** The room's walls as rectangles, for movement and sight. */
export function wallRects() {
  const W = 1280;
  const H = 720;
  return [
    { x: 0, y: 0, w: W, h: WALL },
    { x: 0, y: H - WALL, w: W, h: WALL },
    { x: 0, y: 0, w: WALL, h: H },
    { x: W - WALL, y: 0, w: WALL, h: H },
  ];
}
