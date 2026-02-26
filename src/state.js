/**
 * Shared reactive state for the shed configuration.
 * Uses a simple event emitter pattern — any module can subscribe to changes.
 */

const _listeners = new Set();

// Door type definitions
export const DOOR_TYPES = {
  single: { label: 'Single Door', defaultWidth: 900, defaultHeight: 2000 },
  double: { label: 'Double Door', defaultWidth: 1500, defaultHeight: 2000 },
  sliding: { label: 'Sliding Door', defaultWidth: 1800, defaultHeight: 2100 },
  french: { label: 'French Door', defaultWidth: 1400, defaultHeight: 2000 },
  stable: { label: 'Stable Door', defaultWidth: 900, defaultHeight: 2000 },
};

export const WINDOW_TYPES = {
  standard: { label: 'Standard', defaultWidth: 600, defaultHeight: 800 },
  large: { label: 'Large', defaultWidth: 1000, defaultHeight: 1000 },
  slim: { label: 'Slim', defaultWidth: 400, defaultHeight: 1200 },
};

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
    back: { openings: [] },
    left: { openings: [] },
    right: { openings: [] }
  },
  // Interaction state
  mode: 'drag',              // 'drag' | 'door' | 'window'
  hoveredWall: null,
  selectedWall: null,
  dragHandle: null,
  // Selected opening for editing
  selectedOpening: null,     // { wall, id }
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

/** Add an opening to a wall */
export function addOpening(wallSide, type, subType) {
  const wall = state.walls[wallSide];
  const wallLength = (wallSide === 'front' || wallSide === 'back') ? state.width : state.depth;

  const typeInfo = type === 'door'
    ? (DOOR_TYPES[subType] || DOOR_TYPES.single)
    : (WINDOW_TYPES[subType] || WINDOW_TYPES.standard);

  const openingWidth = typeInfo.defaultWidth;
  const openingHeight = typeInfo.defaultHeight;

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
    return false;
  }

  const id = Date.now() + Math.random();
  wall.openings.push({
    id,
    type,
    subType: subType || (type === 'door' ? 'single' : 'standard'),
    x,
    width: openingWidth,
    height: openingHeight,
    yOffset: type === 'window' ? 900 : 0
  });

  state.selectedOpening = { wall: wallSide, id };
  _listeners.forEach(fn => fn(state));
  return true;
}

/** Update an opening's properties */
export function updateOpening(wallSide, openingId, patch) {
  const wall = state.walls[wallSide];
  const opening = wall.openings.find(o => o.id === openingId);
  if (!opening) return;

  Object.assign(opening, patch);

  // If subType changed, update default dimensions
  if (patch.subType) {
    const typeInfo = opening.type === 'door'
      ? (DOOR_TYPES[patch.subType] || DOOR_TYPES.single)
      : (WINDOW_TYPES[patch.subType] || WINDOW_TYPES.standard);
    opening.width = typeInfo.defaultWidth;
    opening.height = typeInfo.defaultHeight;
  }

  // Clamp position within wall bounds
  const wallLength = (wallSide === 'front' || wallSide === 'back') ? state.width : state.depth;
  opening.x = Math.max(50, Math.min(wallLength - opening.width - 50, opening.x));

  _listeners.forEach(fn => fn(state));
}

/** Move an opening along the wall */
export function moveOpening(wallSide, openingId, newX) {
  const wall = state.walls[wallSide];
  const opening = wall.openings.find(o => o.id === openingId);
  if (!opening) return;

  const wallLength = (wallSide === 'front' || wallSide === 'back') ? state.width : state.depth;
  opening.x = Math.max(50, Math.min(wallLength - opening.width - 50, newX));

  // Prevent overlap with other openings
  const others = wall.openings.filter(o => o.id !== openingId).map(o => ({ left: o.x, right: o.x + o.width }));
  for (const other of others) {
    if (opening.x < other.right && opening.x + opening.width > other.left) {
      // Push to nearest clear side
      const pushLeft = other.left - opening.width - 20;
      const pushRight = other.right + 20;
      opening.x = Math.abs(opening.x - pushLeft) < Math.abs(opening.x - pushRight) ? pushLeft : pushRight;
    }
  }

  opening.x = Math.max(50, Math.min(wallLength - opening.width - 50, opening.x));
  _listeners.forEach(fn => fn(state));
}

/** Remove an opening by id */
export function removeOpening(wallSide, openingId) {
  const wall = state.walls[wallSide];
  wall.openings = wall.openings.filter(o => o.id !== openingId);
  if (state.selectedOpening?.id === openingId) {
    state.selectedOpening = null;
  }
  _listeners.forEach(fn => fn(state));
}

/** Select an opening for editing */
export function selectOpening(wallSide, openingId) {
  state.selectedOpening = openingId ? { wall: wallSide, id: openingId } : null;
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
    back: { openings: [] },
    left: { openings: [] },
    right: { openings: [] }
  };
  state.mode = 'drag';
  state.hoveredWall = null;
  state.selectedWall = null;
  state.selectedOpening = null;
  _listeners.forEach(fn => fn(state));
}

/** Get all openings as flat list */
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
