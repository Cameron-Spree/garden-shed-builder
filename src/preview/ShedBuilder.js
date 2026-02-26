/**
 * ShedBuilder — Generates 3D shed geometry with procedural wood-grain textures.
 * Fixes roof clipping and improves visual quality.
 */
import * as THREE from 'three';
import { getScene } from './SceneManager.js';

const MM_TO_M = 0.001;
let shedGroup = null;

// Wood colour palettes (base, grain)
const WOOD_PALETTES = {
    spruce: { base: 0xc9a96e, grain: 0xb8944a, dark: 0xa07830, roof: 0x404040, floor: 0xd4b483 },
    douglas: { base: 0xa07040, grain: 0x8b5e34, dark: 0x6d4520, roof: 0x3a3a3a, floor: 0xbf8a50 },
    larch: { base: 0xd4a058, grain: 0xc0884c, dark: 0xa87030, roof: 0x454545, floor: 0xe2b870 },
};

const FOUNDATION_COLORS = {
    wood: 0x8b7355,
    concrete: 0x999999,
};

// --- Procedural Textures ---

function createWoodTexture(palette, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base color
    const baseR = (palette.base >> 16) & 0xff;
    const baseG = (palette.base >> 8) & 0xff;
    const baseB = palette.base & 0xff;

    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.fillRect(0, 0, width, height);

    // Horizontal grain lines
    const grainR = (palette.grain >> 16) & 0xff;
    const grainG = (palette.grain >> 8) & 0xff;
    const grainB = palette.grain & 0xff;

    for (let y = 0; y < height; y += 3) {
        const alpha = 0.08 + Math.random() * 0.12;
        const offset = Math.sin(y * 0.05) * 2;
        ctx.strokeStyle = `rgba(${grainR},${grainG},${grainB},${alpha})`;
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y + offset);
        ctx.lineTo(width, y + offset + Math.sin(y * 0.02) * 3);
        ctx.stroke();
    }

    // Occasional darker knots
    for (let i = 0; i < 4; i++) {
        const kx = Math.random() * width;
        const ky = Math.random() * height;
        const kr = 6 + Math.random() * 12;
        const darkR = (palette.dark >> 16) & 0xff;
        const darkG = (palette.dark >> 8) & 0xff;
        const darkB = palette.dark & 0xff;
        const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        grad.addColorStop(0, `rgba(${darkR},${darkG},${darkB},0.4)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(kx - kr, ky - kr, kr * 2, kr * 2);
    }

    // Vertical board seams
    const boardWidth = 50 + Math.random() * 30;
    for (let x = boardWidth; x < width; x += boardWidth + Math.random() * 20) {
        ctx.strokeStyle = `rgba(0,0,0,0.08)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createRoofTexture(width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Dark base
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(0, 0, width, height);

    // Shingle rows
    const shingleH = 30;
    for (let row = 0; row < height / shingleH; row++) {
        const y = row * shingleH;
        const offsetX = (row % 2) * 40;

        for (let x = -40 + offsetX; x < width; x += 80) {
            const brightness = 50 + Math.random() * 25;
            ctx.fillStyle = `rgb(${brightness},${brightness},${brightness + 5})`;
            ctx.fillRect(x + 1, y + 1, 78, shingleH - 2);

            // Subtle edge
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 1, y + 1, 78, shingleH - 2);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createFloorTexture(palette, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const baseR = (palette.floor >> 16) & 0xff;
    const baseG = (palette.floor >> 8) & 0xff;
    const baseB = palette.floor & 0xff;

    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.fillRect(0, 0, width, height);

    // Floor planks
    const plankW = 60;
    for (let x = 0; x < width; x += plankW) {
        // Plank variation
        const v = -10 + Math.random() * 20;
        ctx.fillStyle = `rgb(${baseR + v},${baseG + v},${baseB + v})`;
        ctx.fillRect(x + 1, 0, plankW - 2, height);

        // Grain
        for (let y = 0; y < height; y += 4) {
            ctx.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 2, y);
            ctx.lineTo(x + plankW - 2, y + Math.sin(y * 0.03) * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// --- Material Creation ---

function createWoodMaterial(palette) {
    const tex = createWoodTexture(palette);
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.72,
        metalness: 0.02,
        bumpMap: tex,
        bumpScale: 0.015,
    });
}

function createRoofMaterial() {
    const tex = createRoofTexture();
    tex.repeat.set(3, 2);
    return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.05,
    });
}

function createFloorMaterial(palette) {
    const tex = createFloorTexture(palette);
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,
        metalness: 0.02,
    });
}

function createPostMaterial(palette) {
    const tex = createWoodTexture(palette, 128, 256);
    tex.repeat.set(1, 3);
    return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.65,
        metalness: 0.02,
    });
}

// --- Main Build ---

export function build(state) {
    const scene = getScene();
    if (!scene) return;

    if (shedGroup) {
        scene.remove(shedGroup);
        shedGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
                else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
    }

    shedGroup = new THREE.Group();

    const w = state.width * MM_TO_M;
    const d = state.depth * MM_TO_M;
    const h = state.wallHeight * MM_TO_M;
    const t = state.wallThickness * MM_TO_M;
    const palette = WOOD_PALETTES[state.woodType] || WOOD_PALETTES.spruce;

    const cx = -w / 2;
    const cz = -d / 2;
    const baseY = 0.08;

    buildFoundation(cx, cz, w, d, t, state.foundation);
    buildFloor(cx, cz, w, d, t, palette, baseY);
    buildWalls(cx, cz, w, d, h, t, palette, state, baseY);
    buildPosts(cx, cz, w, d, h, t, palette, baseY);
    buildRoof(cx, cz, w, d, h, t, palette, state.roofType, baseY);

    scene.add(shedGroup);
}

function buildFoundation(cx, cz, w, d, t, type) {
    const color = FOUNDATION_COLORS[type] || FOUNDATION_COLORS.wood;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 });
    const foundH = 0.08;
    const overhang = 0.08;
    const geo = new THREE.BoxGeometry(w + overhang * 2, foundH, d + overhang * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx + w / 2, foundH / 2, cz + d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function buildFloor(cx, cz, w, d, t, palette, baseY) {
    const mat = createFloorMaterial(palette);
    const floorH = 0.03;
    const geo = new THREE.BoxGeometry(w - t * 2, floorH, d - t * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx + w / 2, baseY + floorH / 2, cz + d / 2);
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function buildWalls(cx, cz, w, d, h, t, palette, state, baseY) {
    const mat = createWoodMaterial(palette);

    const wallDefs = [
        { side: 'front', pos: [cx + w / 2, baseY + h / 2, cz + t / 2], size: [w, h, t] },
        { side: 'back', pos: [cx + w / 2, baseY + h / 2, cz + d - t / 2], size: [w, h, t] },
        { side: 'left', pos: [cx + t / 2, baseY + h / 2, cz + d / 2], size: [t, h, d - t * 2] },
        { side: 'right', pos: [cx + w - t / 2, baseY + h / 2, cz + d / 2], size: [t, h, d - t * 2] },
    ];

    for (const wallDef of wallDefs) {
        const openings = state.walls[wallDef.side]?.openings || [];

        if (openings.length === 0) {
            const geo = new THREE.BoxGeometry(...wallDef.size);
            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.position.set(...wallDef.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            shedGroup.add(mesh);
        } else {
            buildWallWithOpenings(wallDef, openings, mat, palette, w, d, h, t, cx, cz, baseY);
        }
    }
}

function buildWallWithOpenings(wallDef, openings, wallMat, palette, w, d, h, t, cx, cz, baseY) {
    const isHorizontal = wallDef.side === 'front' || wallDef.side === 'back';
    const wallLength = isHorizontal ? w : (d - t * 2);
    const sorted = [...openings].sort((a, b) => a.x - b.x);

    let currentPos = 0;

    for (const opening of sorted) {
        const openX = opening.x * MM_TO_M;
        const openW = opening.width * MM_TO_M;
        const openH = opening.height * MM_TO_M;
        const openYOff = (opening.yOffset || 0) * MM_TO_M;

        // Segment before opening
        if (openX > currentPos + 0.005) {
            addWallSeg(wallDef, currentPos, openX - currentPos, h, t, wallMat, cx, cz, baseY, w, d, isHorizontal);
        }

        // Above opening
        const aboveH = h - openH - openYOff;
        if (aboveH > 0.01) {
            addWallSegAt(wallDef, openX, openW, aboveH, t, wallMat, cx, cz, baseY + openH + openYOff, w, d, isHorizontal);
        }

        // Below opening (windows)
        if (openYOff > 0.01) {
            addWallSegAt(wallDef, openX, openW, openYOff, t, wallMat, cx, cz, baseY, w, d, isHorizontal);
        }

        // Frame + glass
        addOpeningFrame(wallDef, openX, openW, openH, openYOff, t, opening, palette, cx, cz, baseY, w, d, isHorizontal);

        currentPos = openX + openW;
    }

    // Remaining segment after last opening
    if (currentPos < wallLength - 0.005) {
        addWallSeg(wallDef, currentPos, wallLength - currentPos, h, t, wallMat, cx, cz, baseY, w, d, isHorizontal);
    }
}

function addWallSeg(wallDef, startAlong, segLen, h, t, mat, cx, cz, baseY, w, d, isHoriz) {
    if (isHoriz) {
        const geo = new THREE.BoxGeometry(segLen, h, t);
        const mesh = new THREE.Mesh(geo, mat.clone());
        const xPos = (wallDef.side === 'front' || wallDef.side === 'back') ? cx + startAlong + segLen / 2 : wallDef.pos[0];
        mesh.position.set(xPos, baseY + h / 2, wallDef.pos[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shedGroup.add(mesh);
    } else {
        const geo = new THREE.BoxGeometry(t, h, segLen);
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.position.set(wallDef.pos[0], baseY + h / 2, cz + t + startAlong + segLen / 2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shedGroup.add(mesh);
    }
}

function addWallSegAt(wallDef, startAlong, segLen, segH, t, mat, cx, cz, segBaseY, w, d, isHoriz) {
    if (isHoriz) {
        const geo = new THREE.BoxGeometry(segLen, segH, t);
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.position.set(cx + startAlong + segLen / 2, segBaseY + segH / 2, wallDef.pos[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shedGroup.add(mesh);
    } else {
        const geo = new THREE.BoxGeometry(t, segH, segLen);
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.position.set(wallDef.pos[0], segBaseY + segH / 2, cz + t + startAlong + segLen / 2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shedGroup.add(mesh);
    }
}

function addOpeningFrame(wallDef, openX, openW, openH, openYOff, t, opening, palette, cx, cz, baseY, w, d, isHoriz) {
    const postMat = createPostMaterial(palette);
    const frameT = 0.04;
    const isDoor = opening.type === 'door';

    // Glass pane
    const glassColor = isDoor ? 0x88bbdd : 0xaaddee;
    const glassMat = new THREE.MeshStandardMaterial({
        color: glassColor,
        roughness: 0.05,
        metalness: 0.15,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
    });

    if (isHoriz) {
        const glassGeo = new THREE.BoxGeometry(openW - frameT * 2, openH - frameT * 2, t * 0.15);
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(cx + openX + openW / 2, baseY + openYOff + openH / 2, wallDef.pos[2]);
        shedGroup.add(glass);
    } else {
        const glassGeo = new THREE.BoxGeometry(t * 0.15, openH - frameT * 2, openW - frameT * 2);
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(wallDef.pos[0], baseY + openYOff + openH / 2, cz + t + openX + openW / 2);
        shedGroup.add(glass);
    }

    // Frame bars
    const bars = [];
    if (isHoriz) {
        // Top bar
        bars.push({ s: [openW + 0.02, frameT, t * 1.05], p: [cx + openX + openW / 2, baseY + openYOff + openH - frameT / 2, wallDef.pos[2]] });
        // Bottom bar
        if (!isDoor) bars.push({ s: [openW + 0.02, frameT, t * 1.05], p: [cx + openX + openW / 2, baseY + openYOff + frameT / 2, wallDef.pos[2]] });
        // Left post
        bars.push({ s: [frameT, openH, t * 1.05], p: [cx + openX + frameT / 2, baseY + openYOff + openH / 2, wallDef.pos[2]] });
        // Right post
        bars.push({ s: [frameT, openH, t * 1.05], p: [cx + openX + openW - frameT / 2, baseY + openYOff + openH / 2, wallDef.pos[2]] });

        // Cross bars for double/french/sliding doors
        if (isDoor && (opening.subType === 'double' || opening.subType === 'french' || opening.subType === 'sliding')) {
            bars.push({ s: [frameT * 0.6, openH, t * 1.05], p: [cx + openX + openW / 2, baseY + openYOff + openH / 2, wallDef.pos[2]] });
        }
        // Stable door horizontal split
        if (isDoor && opening.subType === 'stable') {
            bars.push({ s: [openW, frameT * 0.6, t * 1.05], p: [cx + openX + openW / 2, baseY + openYOff + openH * 0.55, wallDef.pos[2]] });
        }
    } else {
        bars.push({ s: [t * 1.05, frameT, openW + 0.02], p: [wallDef.pos[0], baseY + openYOff + openH - frameT / 2, cz + t + openX + openW / 2] });
        if (!isDoor) bars.push({ s: [t * 1.05, frameT, openW + 0.02], p: [wallDef.pos[0], baseY + openYOff + frameT / 2, cz + t + openX + openW / 2] });
        bars.push({ s: [t * 1.05, openH, frameT], p: [wallDef.pos[0], baseY + openYOff + openH / 2, cz + t + openX + frameT / 2] });
        bars.push({ s: [t * 1.05, openH, frameT], p: [wallDef.pos[0], baseY + openYOff + openH / 2, cz + t + openX + openW - frameT / 2] });

        if (isDoor && (opening.subType === 'double' || opening.subType === 'french' || opening.subType === 'sliding')) {
            bars.push({ s: [t * 1.05, openH, frameT * 0.6], p: [wallDef.pos[0], baseY + openYOff + openH / 2, cz + t + openX + openW / 2] });
        }
        if (isDoor && opening.subType === 'stable') {
            bars.push({ s: [t * 1.05, frameT * 0.6, openW], p: [wallDef.pos[0], baseY + openYOff + openH * 0.55, cz + t + openX + openW / 2] });
        }
    }

    for (const bar of bars) {
        const geo = new THREE.BoxGeometry(...bar.s);
        const mesh = new THREE.Mesh(geo, postMat.clone());
        mesh.position.set(...bar.p);
        mesh.castShadow = true;
        shedGroup.add(mesh);
    }

    // Door handle (small sphere)
    if (isDoor) {
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 });
        const handleGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const handle = new THREE.Mesh(handleGeo, handleMat);
        if (isHoriz) {
            const handleSide = (opening.subType === 'double' || opening.subType === 'french') ? openW * 0.25 : openW * 0.8;
            handle.position.set(cx + openX + handleSide, baseY + openH * 0.45, wallDef.pos[2] + t * 0.6);
        } else {
            const handleSide = (opening.subType === 'double' || opening.subType === 'french') ? openW * 0.25 : openW * 0.8;
            handle.position.set(wallDef.pos[0] + t * 0.6, baseY + openH * 0.45, cz + t + openX + handleSide);
        }
        shedGroup.add(handle);
    }
}

function buildPosts(cx, cz, w, d, h, t, palette, baseY) {
    const mat = createPostMaterial(palette);
    const postSize = Math.max(t * 1.3, 0.1);

    const positions = [
        [cx + t / 2, cz + t / 2],
        [cx + w - t / 2, cz + t / 2],
        [cx + t / 2, cz + d - t / 2],
        [cx + w - t / 2, cz + d - t / 2]
    ];

    for (const [px, pz] of positions) {
        const geo = new THREE.BoxGeometry(postSize, h + 0.01, postSize);
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.position.set(px, baseY + h / 2, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shedGroup.add(mesh);
    }
}

function buildRoof(cx, cz, w, d, h, t, palette, roofType, baseY) {
    const mat = createRoofMaterial();
    const wallTop = baseY + h;
    const overhang = 0.2;
    const roofThickness = 0.05;

    if (roofType === 'apex') {
        buildApexRoof(cx, cz, w, d, wallTop, overhang, roofThickness, mat, palette);
    } else {
        buildPentRoof(cx, cz, w, d, wallTop, overhang, roofThickness, mat);
    }

    // Fascia board along front edge
    const fasciaMat = createPostMaterial(palette);
    const fasciaGeo = new THREE.BoxGeometry(w + overhang * 2, 0.08, 0.03);
    const fascia = new THREE.Mesh(fasciaGeo, fasciaMat);
    fascia.position.set(cx + w / 2, wallTop + (roofType === 'pent' ? 0.35 : 0) + 0.04, cz - overhang);
    fascia.castShadow = true;
    shedGroup.add(fascia);
}

function buildPentRoof(cx, cz, w, d, wallTop, overhang, thickness, mat) {
    const rise = 0.35;
    // Front edge is higher, back is at wallTop
    const frontY = wallTop + rise;
    const backY = wallTop;

    const vertices = new Float32Array([
        // Bottom
        cx - overhang, backY, cz + d + overhang,
        cx + w + overhang, backY, cz + d + overhang,
        cx + w + overhang, frontY, cz - overhang,
        cx - overhang, frontY, cz - overhang,
        // Top (offset by thickness along normal)
        cx - overhang, backY + thickness, cz + d + overhang,
        cx + w + overhang, backY + thickness, cz + d + overhang,
        cx + w + overhang, frontY + thickness, cz - overhang,
        cx - overhang, frontY + thickness, cz - overhang,
    ]);

    const indices = [
        // Top face
        4, 7, 6, 4, 6, 5,
        // Bottom face
        0, 1, 2, 0, 2, 3,
        // Front
        3, 2, 6, 3, 6, 7,
        // Back
        0, 4, 5, 0, 5, 1,
        // Left
        0, 3, 7, 0, 7, 4,
        // Right
        1, 5, 6, 1, 6, 2,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // UV mapping for texture
    const uvs = new Float32Array([
        0, 0, 1, 0, 1, 1, 0, 1,
        0, 0, 1, 0, 1, 1, 0, 1,
    ]);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function buildApexRoof(cx, cz, w, d, wallTop, overhang, thickness, mat, palette) {
    const ridgeHeight = 0.55;
    const ridgeY = wallTop + ridgeHeight;

    // Left slope
    buildRoofSlope(
        [cx - overhang, wallTop, cz - overhang],
        [cx + w / 2, ridgeY, cz - overhang],
        [cx + w / 2, ridgeY, cz + d + overhang],
        [cx - overhang, wallTop, cz + d + overhang],
        thickness, mat
    );

    // Right slope
    buildRoofSlope(
        [cx + w / 2, ridgeY, cz - overhang],
        [cx + w + overhang, wallTop, cz - overhang],
        [cx + w + overhang, wallTop, cz + d + overhang],
        [cx + w / 2, ridgeY, cz + d + overhang],
        thickness, mat
    );

    // Gable triangles
    const gableMat = createWoodMaterial(palette);
    for (const zPos of [cz, cz + d]) {
        const gableVerts = new Float32Array([
            cx, wallTop, zPos,
            cx + w, wallTop, zPos,
            cx + w / 2, ridgeY, zPos,
        ]);
        const gableGeo = new THREE.BufferGeometry();
        gableGeo.setAttribute('position', new THREE.BufferAttribute(gableVerts, 3));
        const gableUvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
        gableGeo.setAttribute('uv', new THREE.BufferAttribute(gableUvs, 2));

        // Front and back faces
        gableGeo.setIndex([0, 1, 2]);
        gableGeo.computeVertexNormals();
        shedGroup.add(new THREE.Mesh(gableGeo, gableMat.clone()));

        const gableGeo2 = gableGeo.clone();
        gableGeo2.setIndex([2, 1, 0]);
        gableGeo2.computeVertexNormals();
        shedGroup.add(new THREE.Mesh(gableGeo2, gableMat.clone()));
    }
}

function buildRoofSlope(p0, p1, p2, p3, thickness, mat) {
    // Calculate normal for thickness offset
    const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const v2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    const nx = v1[1] * v2[2] - v1[2] * v2[1];
    const ny = v1[2] * v2[0] - v1[0] * v2[2];
    const nz = v1[0] * v2[1] - v1[1] * v2[0];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const dn = [nx / len * thickness, ny / len * thickness, nz / len * thickness];

    const vertices = new Float32Array([
        ...p0, ...p1, ...p2, ...p3,
        p0[0] + dn[0], p0[1] + dn[1], p0[2] + dn[2],
        p1[0] + dn[0], p1[1] + dn[1], p1[2] + dn[2],
        p2[0] + dn[0], p2[1] + dn[1], p2[2] + dn[2],
        p3[0] + dn[0], p3[1] + dn[1], p3[2] + dn[2],
    ]);

    const indices = [
        0, 2, 1, 0, 3, 2, // bottom
        4, 5, 6, 4, 6, 7, // top
        0, 1, 5, 0, 5, 4, // front
        2, 3, 7, 2, 7, 6, // back
        0, 4, 7, 0, 7, 3, // left
        1, 2, 6, 1, 6, 5, // right
    ];

    const uvs = new Float32Array([
        0, 0, 1, 0, 1, 1, 0, 1,
        0, 0, 1, 0, 1, 1, 0, 1,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}
