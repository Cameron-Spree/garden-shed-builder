/**
 * BlueprintEditor — 2D top-down canvas rendering of the shed floor plan.
 * Handles drag-to-resize, wall hover/click, dimension labels, and grid.
 */
import state, { update, addOpening } from '../state.js';

const GRID_SIZE = 100; // mm per grid cell
const SCALE_FACTOR = 0.09; // mm to pixels
const HANDLE_SIZE = 8;
const WALL_COLOR = '#2d3748';
const WALL_HOVER_COLOR = '#10b981';
const GRID_COLOR = 'rgba(255,255,255,0.04)';
const GRID_COLOR_MAJOR = 'rgba(255,255,255,0.08)';
const DIM_COLOR = '#3b82f6';
const OPENING_DOOR_COLOR = 'rgba(239, 68, 68, 0.6)';
const OPENING_WINDOW_COLOR = 'rgba(59, 130, 246, 0.6)';

let canvas, ctx;
let canvasW, canvasH;
let offsetX, offsetY, scale;
let dragging = null; // { handle: 'right' | 'bottom' | 'left' | 'top' | 'br' | ... , startX, startY, startWidth, startDepth }
let hoveredWall = null;
let tooltip = null;

export function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    draw(state);
}

function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvasW = rect.width;
    canvasH = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(state);
}

function toScreen(mmX, mmY) {
    return [offsetX + mmX * scale, offsetY + mmY * scale];
}

function toMm(screenX, screenY) {
    return [(screenX - offsetX) / scale, (screenY - offsetY) / scale];
}

function computeLayout(s) {
    // Scale to fit with padding
    const padX = 120, padY = 100;
    const availW = canvasW - padX * 2;
    const availH = canvasH - padY * 2;
    scale = Math.min(availW / s.width, availH / s.depth, 0.15);
    offsetX = (canvasW - s.width * scale) / 2;
    offsetY = (canvasH - s.depth * scale) / 2;
}

export function draw(s) {
    if (!ctx) return;
    computeLayout(s);

    ctx.clearRect(0, 0, canvasW, canvasH);

    drawGrid(s);
    drawShedOutline(s);
    drawOpenings(s);
    drawDimensions(s);
    drawHandles(s);
    drawWallLabels(s);
}

function drawGrid(s) {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    const startMmX = -Math.ceil(offsetX / scale / GRID_SIZE) * GRID_SIZE;
    const endMmX = Math.ceil((canvasW - offsetX) / scale / GRID_SIZE) * GRID_SIZE;
    for (let mmX = startMmX; mmX <= endMmX; mmX += GRID_SIZE) {
        const isMajor = mmX % (GRID_SIZE * 5) === 0;
        ctx.strokeStyle = isMajor ? GRID_COLOR_MAJOR : GRID_COLOR;
        ctx.lineWidth = isMajor ? 0.8 : 0.5;
        const [sx] = toScreen(mmX, 0);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, canvasH);
        ctx.stroke();
    }

    // Horizontal grid lines
    const startMmY = -Math.ceil(offsetY / scale / GRID_SIZE) * GRID_SIZE;
    const endMmY = Math.ceil((canvasH - offsetY) / scale / GRID_SIZE) * GRID_SIZE;
    for (let mmY = startMmY; mmY <= endMmY; mmY += GRID_SIZE) {
        const isMajor = mmY % (GRID_SIZE * 5) === 0;
        ctx.strokeStyle = isMajor ? GRID_COLOR_MAJOR : GRID_COLOR;
        ctx.lineWidth = isMajor ? 0.8 : 0.5;
        const [, sy] = toScreen(0, mmY);
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(canvasW, sy);
        ctx.stroke();
    }
}

function drawShedOutline(s) {
    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;

    // Fill
    ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
    ctx.fillRect(x, y, w, h);

    // Dashed outline
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Solid walls with hover highlight
    const walls = [
        { side: 'front', x1: 0, y1: 0, x2: s.width, y2: 0 },
        { side: 'back', x1: 0, y1: s.depth, x2: s.width, y2: s.depth },
        { side: 'left', x1: 0, y1: 0, x2: 0, y2: s.depth },
        { side: 'right', x1: s.width, y1: 0, x2: s.width, y2: s.depth }
    ];

    for (const wall of walls) {
        const [sx1, sy1] = toScreen(wall.x1, wall.y1);
        const [sx2, sy2] = toScreen(wall.x2, wall.y2);
        const isHovered = hoveredWall === wall.side;

        ctx.strokeStyle = isHovered ? WALL_HOVER_COLOR : '#4a5568';
        ctx.lineWidth = isHovered ? 4 : 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        if (isHovered) {
            ctx.shadowColor = WALL_HOVER_COLOR;
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    // Corner posts
    const postSize = 6;
    ctx.fillStyle = '#718096';
    const corners = [[0, 0], [s.width, 0], [0, s.depth], [s.width, s.depth]];
    for (const [cx, cy] of corners) {
        const [sx, sy] = toScreen(cx, cy);
        ctx.fillRect(sx - postSize / 2, sy - postSize / 2, postSize, postSize);
    }
}

function drawOpenings(s) {
    for (const [side, wall] of Object.entries(s.walls)) {
        for (const opening of wall.openings) {
            drawOpening(s, side, opening);
        }
    }
}

function drawOpening(s, side, opening) {
    const isDoor = opening.type === 'door';
    const color = isDoor ? OPENING_DOOR_COLOR : OPENING_WINDOW_COLOR;
    const thickness = 8;

    let sx, sy, sw, sh;

    if (side === 'front') {
        [sx, sy] = toScreen(opening.x, -thickness / scale / 2);
        sw = opening.width * scale;
        sh = thickness;
    } else if (side === 'back') {
        [sx, sy] = toScreen(opening.x, s.depth - thickness / scale / 2);
        sw = opening.width * scale;
        sh = thickness;
    } else if (side === 'left') {
        [sx, sy] = toScreen(-thickness / scale / 2, opening.x);
        sw = thickness;
        sh = opening.width * scale;
    } else {
        [sx, sy] = toScreen(s.width - thickness / scale / 2, opening.x);
        sw = thickness;
        sh = opening.width * scale;
    }

    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, sw, sh);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '500 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = isDoor ? 'D' : 'W';
    ctx.fillText(label, sx + sw / 2, sy + sh / 2);
}

function drawDimensions(s) {
    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;
    const GAP = 30;
    const ARR = 6;

    ctx.strokeStyle = DIM_COLOR;
    ctx.fillStyle = DIM_COLOR;
    ctx.lineWidth = 1;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bottom dimension (width)
    const by = y + h + GAP;
    drawDimLine(x, by, x + w, by, `${s.width}`, ARR);

    // Right dimension (depth)
    const rx = x + w + GAP;
    drawDimLineVert(rx, y, rx, y + h, `${s.depth}`, ARR);
}

function drawDimLine(x1, y1, x2, y2, label, arr) {
    // Leader lines
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 10);
    ctx.lineTo(x1, y1 + 5);
    ctx.moveTo(x2, y2 - 10);
    ctx.lineTo(x2, y2 + 5);
    ctx.stroke();

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrows
    drawArrow(x1, y1, 1, 0, arr);
    drawArrow(x2, y2, -1, 0, arr);

    // Label
    const mx = (x1 + x2) / 2;
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(mx - 28, y1 - 9, 56, 18);
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText(label, mx, y1);
}

function drawDimLineVert(x1, y1, x2, y2, label, arr) {
    ctx.beginPath();
    ctx.moveTo(x1 - 10, y1);
    ctx.lineTo(x1 + 5, y1);
    ctx.moveTo(x2 - 10, y2);
    ctx.lineTo(x2 + 5, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrow(x1, y1, 0, 1, arr);
    drawArrow(x2, y2, 0, -1, arr);

    const my = (y1 + y2) / 2;
    ctx.save();
    ctx.translate(x1, my);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(-28, -9, 56, 18);
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText(label, 0, 0);
    ctx.restore();
}

function drawArrow(x, y, dx, dy, size) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size + dy * size * 0.4, y - dy * size - dx * size * 0.4);
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size - dy * size * 0.4, y - dy * size + dx * size * 0.4);
    ctx.stroke();
}

function drawHandles(s) {
    if (state.mode !== 'drag') return;

    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;

    const handles = getHandlePositions(s);

    for (const handle of handles) {
        ctx.fillStyle = dragging?.handle === handle.id ? '#10b981' : '#3b82f6';
        ctx.strokeStyle = '#0f1117';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(handle.sx, handle.sy, HANDLE_SIZE, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

function getHandlePositions(s) {
    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;

    return [
        { id: 'right', sx: x + w, sy: y + h / 2, cursor: 'ew-resize' },
        { id: 'bottom', sx: x + w / 2, sy: y + h, cursor: 'ns-resize' },
        { id: 'left', sx: x, sy: y + h / 2, cursor: 'ew-resize' },
        { id: 'top', sx: x + w / 2, sy: y, cursor: 'ns-resize' },
        { id: 'br', sx: x + w, sy: y + h, cursor: 'nwse-resize' },
    ];
}

function drawWallLabels(s) {
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';

    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;

    ctx.fillText('FRONT', x + w / 2, y - 14);
    ctx.fillText('BACK', x + w / 2, y + h + 14);
    ctx.save();
    ctx.translate(x - 14, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('LEFT', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(x + w + 14, y + h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('RIGHT', 0, 0);
    ctx.restore();
}

// ---- Mouse Interaction ----

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function hitTestHandles(mx, my) {
    if (state.mode !== 'drag') return null;
    const handles = getHandlePositions(state);
    for (const h of handles) {
        const dx = mx - h.sx, dy = my - h.sy;
        if (dx * dx + dy * dy < (HANDLE_SIZE + 4) * (HANDLE_SIZE + 4)) {
            return h;
        }
    }
    return null;
}

function hitTestWalls(mx, my) {
    const [x, y] = toScreen(0, 0);
    const w = state.width * scale;
    const h = state.depth * scale;
    const threshold = 8;

    // Front wall
    if (my >= y - threshold && my <= y + threshold && mx >= x && mx <= x + w) return 'front';
    // Back wall
    if (my >= y + h - threshold && my <= y + h + threshold && mx >= x && mx <= x + w) return 'back';
    // Left wall
    if (mx >= x - threshold && mx <= x + threshold && my >= y && my <= y + h) return 'left';
    // Right wall
    if (mx >= x + w - threshold && mx <= x + w + threshold && my >= y && my <= y + h) return 'right';

    return null;
}

function onMouseMove(e) {
    const { x: mx, y: my } = getMousePos(e);

    if (dragging) {
        handleDrag(mx, my);
        return;
    }

    // Handle hover
    const handle = hitTestHandles(mx, my);
    if (handle) {
        canvas.style.cursor = handle.cursor;
        hoveredWall = null;
        draw(state);
        return;
    }

    // Wall hover
    const wall = hitTestWalls(mx, my);
    if (wall !== hoveredWall) {
        hoveredWall = wall;
        canvas.style.cursor = wall ? (state.mode === 'drag' ? 'pointer' : 'copy') : 'crosshair';
        draw(state);
    }
}

function onMouseDown(e) {
    const { x: mx, y: my } = getMousePos(e);

    // Handle drag start
    if (state.mode === 'drag') {
        const handle = hitTestHandles(mx, my);
        if (handle) {
            dragging = {
                handle: handle.id,
                startX: mx,
                startY: my,
                startWidth: state.width,
                startDepth: state.depth
            };
            canvas.style.cursor = handle.cursor;
            return;
        }
    }

    // Wall click — add opening
    if ((state.mode === 'door' || state.mode === 'window') && hoveredWall) {
        const added = addOpening(hoveredWall, state.mode);
        if (!added) {
            // Flash the wall red briefly
            canvas.style.cursor = 'not-allowed';
            setTimeout(() => { canvas.style.cursor = 'copy'; }, 300);
        }
    }
}

function onMouseUp() {
    if (dragging) {
        dragging = null;
        canvas.style.cursor = 'crosshair';
        draw(state);
    }
}

function onMouseLeave() {
    hoveredWall = null;
    dragging = null;
    draw(state);
}

function handleDrag(mx, my) {
    if (!dragging) return;

    const dx = (mx - dragging.startX) / scale;
    const dy = (my - dragging.startY) / scale;
    const snap = (v) => Math.round(v / 100) * 100;

    let newWidth = dragging.startWidth;
    let newDepth = dragging.startDepth;

    if (dragging.handle === 'right' || dragging.handle === 'br') {
        newWidth = snap(dragging.startWidth + dx);
    }
    if (dragging.handle === 'left') {
        newWidth = snap(dragging.startWidth - dx);
    }
    if (dragging.handle === 'bottom' || dragging.handle === 'br') {
        newDepth = snap(dragging.startDepth + dy);
    }
    if (dragging.handle === 'top') {
        newDepth = snap(dragging.startDepth - dy);
    }

    newWidth = Math.max(1500, Math.min(8000, newWidth));
    newDepth = Math.max(1500, Math.min(6000, newDepth));

    if (newWidth !== state.width || newDepth !== state.depth) {
        update({ width: newWidth, depth: newDepth });
    }
}
