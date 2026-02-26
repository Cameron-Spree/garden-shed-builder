/**
 * BlueprintEditor — 2D top-down canvas rendering of the shed floor plan.
 * Supports drag-to-resize, wall hover/click, draggable openings, and dimension labels.
 */
import state, { update, addOpening, moveOpening, selectOpening } from '../state.js';

const GRID_SIZE = 100;
const HANDLE_SIZE = 8;

// Lawsons brand colours for 2D canvas
const WALL_COLOR = '#3a4a5c';
const WALL_HOVER_COLOR = '#009640';
const GRID_COLOR = 'rgba(0, 0, 0, 0.04)';
const GRID_COLOR_MAJOR = 'rgba(0, 0, 0, 0.08)';
const DIM_COLOR = '#009640';
const DIM_LINE_COLOR = '#FFE600';
const OPENING_DOOR_COLOR = 'rgba(0, 150, 64, 0.7)';
const OPENING_WINDOW_COLOR = 'rgba(59, 130, 246, 0.7)';
const SELECTED_OUTLINE = '#FFE600';
const BG_COLOR = '#f0f2f5';

let canvas, ctx;
let canvasW, canvasH;
let offsetX, offsetY, scale;
let dragging = null;
let draggingOpening = null; // { wall, id, startX, openingStartX }
let hoveredWall = null;
let hoveredOpening = null;  // { wall, id }

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

function computeLayout(s) {
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

    // Clear with background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvasW, canvasH);

    drawGrid(s);
    drawShedOutline(s);
    drawOpenings(s);
    drawDimensions(s);
    drawHandles(s);
    drawWallLabels(s);
}

function drawGrid(s) {
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

    // Fill interior
    ctx.fillStyle = 'rgba(0, 150, 64, 0.03)';
    ctx.fillRect(x, y, w, h);

    // Dashed outline
    ctx.strokeStyle = '#d0d5dd';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Solid wall lines
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

        ctx.strokeStyle = isHovered ? WALL_HOVER_COLOR : WALL_COLOR;
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
    const postSize = 7;
    ctx.fillStyle = WALL_COLOR;
    const corners = [[0, 0], [s.width, 0], [0, s.depth], [s.width, s.depth]];
    for (const [cx, cy] of corners) {
        const [sx, sy] = toScreen(cx, cy);
        ctx.beginPath();
        ctx.arc(sx, sy, postSize / 2, 0, Math.PI * 2);
        ctx.fill();
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
    const isSelected = s.selectedOpening?.wall === side && s.selectedOpening?.id === opening.id;
    const isHover = hoveredOpening?.wall === side && hoveredOpening?.id === opening.id;
    const baseColor = isDoor ? OPENING_DOOR_COLOR : OPENING_WINDOW_COLOR;
    const thickness = 10;

    let sx, sy, sw, sh;
    if (side === 'front') {
        [sx, sy] = toScreen(opening.x, 0);
        sy -= thickness / 2;
        sw = opening.width * scale;
        sh = thickness;
    } else if (side === 'back') {
        [sx, sy] = toScreen(opening.x, s.depth);
        sy -= thickness / 2;
        sw = opening.width * scale;
        sh = thickness;
    } else if (side === 'left') {
        [sx, sy] = toScreen(0, opening.x);
        sx -= thickness / 2;
        sw = thickness;
        sh = opening.width * scale;
    } else {
        [sx, sy] = toScreen(s.width, opening.x);
        sx -= thickness / 2;
        sw = thickness;
        sh = opening.width * scale;
    }

    // Selection highlight
    if (isSelected) {
        ctx.strokeStyle = SELECTED_OUTLINE;
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 3, sy - 3, sw + 6, sh + 6);
        ctx.shadowColor = SELECTED_OUTLINE;
        ctx.shadowBlur = 8;
        ctx.strokeRect(sx - 3, sy - 3, sw + 6, sh + 6);
        ctx.shadowBlur = 0;
    }

    // Fill
    ctx.fillStyle = isHover ? (isDoor ? 'rgba(0, 150, 64, 0.9)' : 'rgba(59, 130, 246, 0.9)') : baseColor;
    ctx.fillRect(sx, sy, sw, sh);

    // Border
    ctx.strokeStyle = isDoor ? '#006e2e' : '#2563eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, sw, sh);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = isDoor ? (opening.subType || 'D').charAt(0).toUpperCase() : 'W';
    ctx.fillText(label, sx + sw / 2, sy + sh / 2);

    // Width dimension label for selected
    if (isSelected) {
        ctx.fillStyle = '#009640';
        ctx.font = '600 10px Inter, sans-serif';
        const dimLabel = `${opening.width}mm`;
        if (side === 'front' || side === 'back') {
            ctx.fillText(dimLabel, sx + sw / 2, sy + (side === 'front' ? -12 : sh + 14));
        } else {
            ctx.save();
            ctx.translate(sx + (side === 'left' ? -12 : sw + 14), sy + sh / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(dimLabel, 0, 0);
            ctx.restore();
        }
    }
}

function drawDimensions(s) {
    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;
    const GAP = 32;
    const ARR = 6;

    ctx.strokeStyle = DIM_COLOR;
    ctx.fillStyle = DIM_COLOR;
    ctx.lineWidth = 1.5;
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bottom dimension (width)
    drawDimLine(x, y + h + GAP, x + w, y + h + GAP, `${s.width}`, ARR);

    // Right dimension (depth)
    drawDimLineVert(x + w + GAP, y, x + w + GAP, y + h, `${s.depth}`, ARR);
}

function drawDimLine(x1, y1, x2, y2, label, arr) {
    // Yellow leader lines
    ctx.strokeStyle = DIM_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 12);
    ctx.lineTo(x1, y1 + 5);
    ctx.moveTo(x2, y2 - 12);
    ctx.lineTo(x2, y2 + 5);
    ctx.stroke();

    // Green main line
    ctx.strokeStyle = DIM_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrow(x1, y1, 1, 0, arr);
    drawArrow(x2, y2, -1, 0, arr);

    const mx = (x1 + x2) / 2;
    // Label background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(mx - 30, y1 - 10, 60, 20);
    // Yellow underline
    ctx.fillStyle = DIM_LINE_COLOR;
    ctx.fillRect(mx - 24, y1 + 7, 48, 2);
    // Label
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText(label, mx, y1);
}

function drawDimLineVert(x1, y1, x2, y2, label, arr) {
    ctx.strokeStyle = DIM_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 - 12, y1);
    ctx.lineTo(x1 + 5, y1);
    ctx.moveTo(x2 - 12, y2);
    ctx.lineTo(x2 + 5, y2);
    ctx.stroke();

    ctx.strokeStyle = DIM_COLOR;
    ctx.lineWidth = 1.5;
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
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(-30, -10, 60, 20);
    ctx.fillStyle = DIM_LINE_COLOR;
    ctx.fillRect(-24, 7, 48, 2);
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText(label, 0, 0);
    ctx.restore();
}

function drawArrow(x, y, dx, dy, size) {
    ctx.strokeStyle = DIM_COLOR;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size + dy * size * 0.4, y - dy * size - dx * size * 0.4);
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size - dy * size * 0.4, y - dy * size + dx * size * 0.4);
    ctx.stroke();
}

function drawHandles(s) {
    if (state.mode !== 'drag') return;

    const handles = getHandlePositions(s);
    for (const handle of handles) {
        const isActive = dragging?.handle === handle.id;
        ctx.fillStyle = isActive ? '#009640' : '#ffffff';
        ctx.strokeStyle = isActive ? '#006e2e' : '#009640';
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
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';

    const [x, y] = toScreen(0, 0);
    const w = s.width * scale;
    const h = s.depth * scale;

    ctx.fillText('FRONT', x + w / 2, y - 18);
    ctx.fillText('BACK', x + w / 2, y + h + 18);
    ctx.save();
    ctx.translate(x - 18, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('LEFT', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(x + w + 18, y + h / 2);
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
        if (dx * dx + dy * dy < (HANDLE_SIZE + 4) * (HANDLE_SIZE + 4)) return h;
    }
    return null;
}

function hitTestWalls(mx, my) {
    const [x, y] = toScreen(0, 0);
    const w = state.width * scale;
    const h = state.depth * scale;
    const threshold = 10;

    if (my >= y - threshold && my <= y + threshold && mx >= x && mx <= x + w) return 'front';
    if (my >= y + h - threshold && my <= y + h + threshold && mx >= x && mx <= x + w) return 'back';
    if (mx >= x - threshold && mx <= x + threshold && my >= y && my <= y + h) return 'left';
    if (mx >= x + w - threshold && mx <= x + w + threshold && my >= y && my <= y + h) return 'right';
    return null;
}

function hitTestOpenings(mx, my) {
    const thickness = 14;
    for (const [side, wall] of Object.entries(state.walls)) {
        for (const opening of wall.openings) {
            let sx, sy, sw, sh;
            if (side === 'front') {
                [sx, sy] = toScreen(opening.x, 0);
                sy -= thickness / 2;
                sw = opening.width * scale;
                sh = thickness;
            } else if (side === 'back') {
                [sx, sy] = toScreen(opening.x, state.depth);
                sy -= thickness / 2;
                sw = opening.width * scale;
                sh = thickness;
            } else if (side === 'left') {
                [sx, sy] = toScreen(0, opening.x);
                sx -= thickness / 2;
                sw = thickness;
                sh = opening.width * scale;
            } else {
                [sx, sy] = toScreen(state.width, opening.x);
                sx -= thickness / 2;
                sw = thickness;
                sh = opening.width * scale;
            }

            if (mx >= sx - 4 && mx <= sx + sw + 4 && my >= sy - 4 && my <= sy + sh + 4) {
                return { wall: side, id: opening.id, sx, sy, sw, sh };
            }
        }
    }
    return null;
}

function onMouseMove(e) {
    const { x: mx, y: my } = getMousePos(e);

    // Dragging a shed handle
    if (dragging) {
        handleDrag(mx, my);
        return;
    }

    // Dragging an opening
    if (draggingOpening) {
        handleOpeningDrag(mx, my);
        return;
    }

    // Hit test openings first (they're on top)
    if (state.mode === 'drag') {
        const openingHit = hitTestOpenings(mx, my);
        if (openingHit) {
            hoveredOpening = openingHit;
            hoveredWall = null;
            canvas.style.cursor = 'grab';
            draw(state);
            return;
        } else if (hoveredOpening) {
            hoveredOpening = null;
        }
    }

    // Handle hover
    const handle = hitTestHandles(mx, my);
    if (handle) {
        canvas.style.cursor = handle.cursor;
        hoveredWall = null;
        hoveredOpening = null;
        draw(state);
        return;
    }

    // Wall hover
    const wall = hitTestWalls(mx, my);
    if (wall !== hoveredWall) {
        hoveredWall = wall;
        hoveredOpening = null;
        canvas.style.cursor = wall
            ? (state.mode === 'drag' ? 'pointer' : 'copy')
            : 'crosshair';
        draw(state);
    }
}

function onMouseDown(e) {
    const { x: mx, y: my } = getMousePos(e);

    // In drag mode, check openings first
    if (state.mode === 'drag') {
        const openingHit = hitTestOpenings(mx, my);
        if (openingHit) {
            const wall = state.walls[openingHit.wall];
            const opening = wall.openings.find(o => o.id === openingHit.id);
            if (opening) {
                draggingOpening = {
                    wall: openingHit.wall,
                    id: openingHit.id,
                    startMouseX: mx,
                    startMouseY: my,
                    startOpeningX: opening.x,
                    side: openingHit.wall
                };
                selectOpening(openingHit.wall, openingHit.id);
                canvas.style.cursor = 'grabbing';
                return;
            }
        }

        // Handle drag
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

    // Wall click — add opening or select
    if ((state.mode === 'door' || state.mode === 'window') && hoveredWall) {
        const added = addOpening(hoveredWall, state.mode, state.mode === 'door' ? 'single' : 'standard');
        if (!added) {
            canvas.style.cursor = 'not-allowed';
            setTimeout(() => { canvas.style.cursor = 'copy'; }, 300);
        }
        return;
    }

    // Click in empty space — deselect
    if (!hitTestOpenings(mx, my)) {
        selectOpening(null, null);
    }
}

function onMouseUp() {
    if (dragging) {
        dragging = null;
        canvas.style.cursor = 'crosshair';
        draw(state);
    }
    if (draggingOpening) {
        draggingOpening = null;
        canvas.style.cursor = hoveredOpening ? 'grab' : 'crosshair';
        draw(state);
    }
}

function onMouseLeave() {
    hoveredWall = null;
    hoveredOpening = null;
    dragging = null;
    draggingOpening = null;
    draw(state);
}

function handleDrag(mx, my) {
    if (!dragging) return;
    const dx = (mx - dragging.startX) / scale;
    const dy = (my - dragging.startY) / scale;
    const snap = (v) => Math.round(v / 100) * 100;

    let newWidth = dragging.startWidth;
    let newDepth = dragging.startDepth;

    if (dragging.handle === 'right' || dragging.handle === 'br') newWidth = snap(dragging.startWidth + dx);
    if (dragging.handle === 'left') newWidth = snap(dragging.startWidth - dx);
    if (dragging.handle === 'bottom' || dragging.handle === 'br') newDepth = snap(dragging.startDepth + dy);
    if (dragging.handle === 'top') newDepth = snap(dragging.startDepth - dy);

    newWidth = Math.max(1500, Math.min(8000, newWidth));
    newDepth = Math.max(1500, Math.min(6000, newDepth));

    if (newWidth !== state.width || newDepth !== state.depth) {
        update({ width: newWidth, depth: newDepth });
    }
}

function handleOpeningDrag(mx, my) {
    if (!draggingOpening) return;

    const isHorizontal = draggingOpening.side === 'front' || draggingOpening.side === 'back';
    const deltaPx = isHorizontal
        ? mx - draggingOpening.startMouseX
        : my - draggingOpening.startMouseY;

    const deltaMm = deltaPx / scale;
    const snap = (v) => Math.round(v / 50) * 50; // Snap to 50mm for openings
    const newX = snap(draggingOpening.startOpeningX + deltaMm);

    moveOpening(draggingOpening.wall, draggingOpening.id, newX);
}
