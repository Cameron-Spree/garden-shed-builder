/**
 * Shared reactive state for the shed configuration.
 * Uses a simple event emitter pattern — any module can subscribe to changes.
 */

const _listeners = new Set();

const state = {
  width: 3000,        // mm
  depth: 2400,        // mm
  wallHeight: 2200,   // mm
  wallThickness: 44,  // mm
  woodType: 'spruce', // 'spruce' | 'douglas' | 'larch'
  roofType: 'pent',   // 'pent' | 'apex'
  foundation: 'wood', // 'wood' | 'concrete'
  walls: {
    front: { openings: [] },
    back:  { openings: [] },
    left:  { openings: [] },
    right: { openings: [] }
  },
  // Interaction state (not persisted)
  mode: 'drag',              // 'drag' | 'door' | 'window'
  hoveredWall: null,         // 'front' | 'back' | 'left' | 'right' | null
  selectedWall: null,
  dragHandle: null,          // which handle is being dragged
};

/** Subscribe to state changes */
export function onChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Update state and notify listeners */
export function update(patch) {
  Object.assign(state, patch);
  _listeners.forEach(fn => fn(state));
}

/** Deep-update walls specifically */
export function updateWalls(wallSide, openings) {
  state.walls[wallSide].openings = openings;
  _listeners.forEach(fn => fn(state));
}

/** Add an opening to a wall */
export function addOpening(wallSide, type) {
  const wall = state.walls[wallSide];
  const wallLength = (wallSide === 'front' || wallSide === 'back') ? state.width : state.depth;

  const openingWidth = type === 'door' ? 900 : 600;
  const openingHeight = type === 'door' ? 2000 : 800;

  // Find a free position along the wall
  let x = 200;
  const existing = wall.openings.map(o => ({ left: o.x, right: o.x + o.width }));
  existing.sort((a, b) => a.left - b.left);

  for (const e of existing) {
    if (x + openingWidth <= e.left) break;
    x = e.right + 100;
  }

  // Check if there's room
  if (x + openingWidth > wallLength - 200) {
    return false; // no room
  }

  wall.openings.push({
    id: Date.now() + Math.random(),
    type,
    x,
    width: openingWidth,
    height: openingHeight,
    yOffset: type === 'window' ? 900 : 0
  });

  _listeners.forEach(fn => fn(state));
  return true;
}

/** Remove an opening by id */
export function removeOpening(wallSide, openingId) {
  const wall = state.walls[wallSide];
  wall.openings = wall.openings.filter(o => o.id !== openingId);
  _listeners.forEach(fn => fn(state));
}

/** Reset state to defaults */
export function reset() {
  state.width = 3000;
  state.depth = 2400;
  state.wallHeight = 2200;
  state.wallThickness = 44;
  state.woodType = 'spruce';
  state.roofType = 'pent';
  state.foundation = 'wood';
  state.walls = {
    front: { openings: [] },
    back:  { openings: [] },
    left:  { openings: [] },
    right: { openings: [] }
  };
  state.mode = 'drag';
  state.hoveredWall = null;
  state.selectedWall = null;
  _listeners.forEach(fn => fn(state));
}

/** Get all openings as flat list with wall info */
export function getAllOpenings() {
  const result = [];
  for (const [side, wall] of Object.entries(state.walls)) {
    for (const opening of wall.openings) {
      result.push({ ...opening, wall: side });
    }
  }
  return result;
}

export default state;
