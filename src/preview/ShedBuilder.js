/**
 * ShedBuilder — Generates 3D shed geometry from the shared state.
 * Rebuilds every time state changes.
 */
import * as THREE from 'three';
import { getScene } from './SceneManager.js';

const MM_TO_M = 0.001;
let shedGroup = null;

// Material palette per wood type
const WOOD_COLORS = {
    spruce: { wall: 0xc9a96e, roof: 0x3d3d3d, post: 0xb8944a, floor: 0xd4b483 },
    douglas: { wall: 0xa07040, roof: 0x3d3d3d, post: 0x8b5e34, floor: 0xbf8a50 },
    larch: { wall: 0xd4a058, roof: 0x3d3d3d, post: 0xc0884c, floor: 0xe2b870 },
};

const FOUNDATION_COLORS = {
    wood: 0x8b7355,
    concrete: 0x999999,
};

export function build(state) {
    const scene = getScene();
    if (!scene) return;

    // Remove old shed
    if (shedGroup) {
        scene.remove(shedGroup);
        shedGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
    }

    shedGroup = new THREE.Group();

    const w = state.width * MM_TO_M;
    const d = state.depth * MM_TO_M;
    const h = state.wallHeight * MM_TO_M;
    const t = state.wallThickness * MM_TO_M;
    const colors = WOOD_COLORS[state.woodType] || WOOD_COLORS.spruce;
    const roofType = state.roofType;

    // Center shed at origin
    const cx = -w / 2;
    const cz = -d / 2;

    // Foundation slab
    buildFoundation(cx, cz, w, d, t, state.foundation);

    // Floor
    buildFloor(cx, cz, w, d, t, colors);

    // Walls
    buildWalls(cx, cz, w, d, h, t, colors, state);

    // Posts at corners
    buildPosts(cx, cz, w, d, h, t, colors);

    // Roof
    buildRoof(cx, cz, w, d, h, t, colors, roofType);

    shedGroup.position.y = 0;
    scene.add(shedGroup);
}

function createMaterial(color, roughness = 0.75) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.05,
    });
}

function buildFoundation(cx, cz, w, d, t, type) {
    const color = FOUNDATION_COLORS[type] || FOUNDATION_COLORS.wood;
    const mat = createMaterial(color, 0.9);
    const foundH = 0.08;
    const overhang = 0.1;
    const geo = new THREE.BoxGeometry(w + overhang * 2, foundH, d + overhang * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx + w / 2, foundH / 2, cz + d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function buildFloor(cx, cz, w, d, t, colors) {
    const mat = createMaterial(colors.floor, 0.8);
    const floorH = 0.04;
    const geo = new THREE.BoxGeometry(w - t * 2, floorH, d - t * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx + w / 2, 0.08 + floorH / 2, cz + d / 2);
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function buildWalls(cx, cz, w, d, h, t, colors, state) {
    const mat = createMaterial(colors.wall);
    const baseY = 0.08;

    const wallDefs = [
        { side: 'front', pos: [cx + w / 2, baseY + h / 2, cz], size: [w, h, t], openDir: 'x' },
        { side: 'back', pos: [cx + w / 2, baseY + h / 2, cz + d], size: [w, h, t], openDir: 'x' },
        { side: 'left', pos: [cx, baseY + h / 2, cz + d / 2], size: [t, h, d], openDir: 'z' },
        { side: 'right', pos: [cx + w, baseY + h / 2, cz + d / 2], size: [t, h, d], openDir: 'z' },
    ];

    for (const wallDef of wallDefs) {
        const openings = state.walls[wallDef.side]?.openings || [];

        if (openings.length === 0) {
            // Solid wall
            const geo = new THREE.BoxGeometry(...wallDef.size);
            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.position.set(...wallDef.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            shedGroup.add(mesh);
        } else {
            // Wall with openings — build segments
            buildWallWithOpenings(wallDef, openings, mat, colors, w, d, h, t, cx, cz, baseY);
        }
    }
}

function buildWallWithOpenings(wallDef, openings, wallMat, colors, w, d, h, t, cx, cz, baseY) {
    const wallLength = (wallDef.side === 'front' || wallDef.side === 'back') ? w : d;
    const wallLengthMm = wallLength / MM_TO_M;

    // Sort openings by position
    const sorted = [...openings].sort((a, b) => a.x - b.x);

    // Build solid segments between openings
    let currentX = 0;

    for (const opening of sorted) {
        const openX = opening.x * MM_TO_M;
        const openW = opening.width * MM_TO_M;
        const openH = opening.height * MM_TO_M;
        const openYOffset = (opening.yOffset || 0) * MM_TO_M;

        // Segment before opening
        if (openX > currentX * MM_TO_M) {
            const segW = openX - currentX * MM_TO_M;
            addWallSegment(wallDef, currentX * MM_TO_M, segW, h, t, wallMat, cx, cz, baseY, wallLength);
        }

        // Above opening
        const aboveH = h - openH - openYOffset;
        if (aboveH > 0.01) {
            addWallSegmentAt(wallDef, openX, openW, aboveH, t, wallMat, cx, cz, baseY + openH + openYOffset, wallLength);
        }

        // Below opening (for windows)
        if (openYOffset > 0.01) {
            addWallSegmentAt(wallDef, openX, openW, openYOffset, t, wallMat, cx, cz, baseY, wallLength);
        }

        // Door/window frame
        addOpeningFrame(wallDef, openX, openW, openH, openYOffset, t, opening.type, colors, cx, cz, baseY, wallLength);

        currentX = (opening.x + opening.width);
    }

    // Segment after last opening
    const remaining = wallLength - currentX * MM_TO_M;
    if (remaining > 0.01) {
        addWallSegment(wallDef, currentX * MM_TO_M, remaining, h, t, wallMat, cx, cz, baseY, wallLength);
    }
}

function addWallSegment(wallDef, startAlongWall, segLength, h, t, mat, cx, cz, baseY, wallTotalLength) {
    const isHorizontal = wallDef.side === 'front' || wallDef.side === 'back';

    let geo, pos;
    if (isHorizontal) {
        geo = new THREE.BoxGeometry(segLength, h, t);
        const xPos = cx + startAlongWall + segLength / 2;
        const zPos = wallDef.side === 'front' ? cz : cz + wallTotalLength + (wallDef.side === 'back' ? 0 : 0);
        pos = [xPos, baseY + h / 2, wallDef.pos[2]];
    } else {
        geo = new THREE.BoxGeometry(t, h, segLength);
        const zPos = cz + startAlongWall + segLength / 2;
        pos = [wallDef.pos[0], baseY + h / 2, zPos];
    }

    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function addWallSegmentAt(wallDef, startAlongWall, segLength, segH, t, mat, cx, cz, segBaseY, wallTotalLength) {
    const isHorizontal = wallDef.side === 'front' || wallDef.side === 'back';

    let geo, pos;
    if (isHorizontal) {
        geo = new THREE.BoxGeometry(segLength, segH, t);
        pos = [cx + startAlongWall + segLength / 2, segBaseY + segH / 2, wallDef.pos[2]];
    } else {
        geo = new THREE.BoxGeometry(t, segH, segLength);
        pos = [wallDef.pos[0], segBaseY + segH / 2, cz + startAlongWall + segLength / 2];
    }

    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function addOpeningFrame(wallDef, openX, openW, openH, openYOffset, t, type, colors, cx, cz, baseY, wallTotalLength) {
    const isHorizontal = wallDef.side === 'front' || wallDef.side === 'back';
    const frameMat = createMaterial(colors.post, 0.6);
    const frameT = 0.04;

    const isDoor = type === 'door';
    const glassColor = isDoor ? 0x88bbdd : 0xaaddee;
    const glassMat = new THREE.MeshStandardMaterial({
        color: glassColor,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.35,
    });

    // Glass pane
    if (isHorizontal) {
        const glassGeo = new THREE.BoxGeometry(openW - frameT * 2, openH - frameT * 2, t * 0.3);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.position.set(
            cx + openX + openW / 2,
            baseY + openYOffset + openH / 2,
            wallDef.pos[2]
        );
        shedGroup.add(glassMesh);
    } else {
        const glassGeo = new THREE.BoxGeometry(t * 0.3, openH - frameT * 2, openW - frameT * 2);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.position.set(
            wallDef.pos[0],
            baseY + openYOffset + openH / 2,
            cz + openX + openW / 2
        );
        shedGroup.add(glassMesh);
    }

    // Frame bars (top, bottom if window, left, right)
    const frameParts = [];

    // Top
    if (isHorizontal) {
        frameParts.push({ size: [openW, frameT, t * 1.1], pos: [cx + openX + openW / 2, baseY + openYOffset + openH - frameT / 2, wallDef.pos[2]] });
        // Bottom
        if (!isDoor) {
            frameParts.push({ size: [openW, frameT, t * 1.1], pos: [cx + openX + openW / 2, baseY + openYOffset + frameT / 2, wallDef.pos[2]] });
        }
        // Left
        frameParts.push({ size: [frameT, openH, t * 1.1], pos: [cx + openX + frameT / 2, baseY + openYOffset + openH / 2, wallDef.pos[2]] });
        // Right
        frameParts.push({ size: [frameT, openH, t * 1.1], pos: [cx + openX + openW - frameT / 2, baseY + openYOffset + openH / 2, wallDef.pos[2]] });
    } else {
        frameParts.push({ size: [t * 1.1, frameT, openW], pos: [wallDef.pos[0], baseY + openYOffset + openH - frameT / 2, cz + openX + openW / 2] });
        if (!isDoor) {
            frameParts.push({ size: [t * 1.1, frameT, openW], pos: [wallDef.pos[0], baseY + openYOffset + frameT / 2, cz + openX + openW / 2] });
        }
        frameParts.push({ size: [t * 1.1, openH, frameT], pos: [wallDef.pos[0], baseY + openYOffset + openH / 2, cz + openX + frameT / 2] });
        frameParts.push({ size: [t * 1.1, openH, frameT], pos: [wallDef.pos[0], baseY + openYOffset + openH / 2, cz + openX + openW - frameT / 2] });
    }

    for (const part of frameParts) {
        const geo = new THREE.BoxGeometry(...part.size);
        const mesh = new THREE.Mesh(geo, frameMat);
        mesh.position.set(...part.pos);
        mesh.castShadow = true;
        shedGroup.add(mesh);
    }
}

function buildPosts(cx, cz, w, d, h, t, colors) {
    const mat = createMaterial(colors.post, 0.65);
    const postSize = Math.max(t * 1.2, 0.1);
    const baseY = 0.08;

    const positions = [
        [cx, cz],
        [cx + w, cz],
        [cx, cz + d],
        [cx + w, cz + d]
    ];

    for (const [px, pz] of positions) {
        const geo = new THREE.BoxGeometry(postSize, h + 0.02, postSize);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(px, baseY + h / 2, pz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shedGroup.add(mesh);
    }
}

function buildRoof(cx, cz, w, d, h, t, colors, roofType) {
    const mat = createMaterial(colors.roof, 0.85);
    const baseY = 0.08 + h;
    const overhang = 0.15;
    const roofThickness = 0.06;

    if (roofType === 'apex') {
        buildApexRoof(cx, cz, w, d, baseY, overhang, roofThickness, mat);
    } else {
        buildPentRoof(cx, cz, w, d, baseY, overhang, roofThickness, mat);
    }
}

function buildPentRoof(cx, cz, w, d, baseY, overhang, thickness, mat) {
    const rise = 0.35;
    const rw = w + overhang * 2;
    const rd = d + overhang * 2;

    // Create a sloped box using BufferGeometry
    const vertices = new Float32Array([
        // Bottom face (y = baseY)
        cx - overhang, baseY, cz - overhang,
        cx + w + overhang, baseY, cz - overhang,
        cx + w + overhang, baseY, cz + d + overhang,
        cx - overhang, baseY, cz + d + overhang,
        // Top face (sloped — front higher)
        cx - overhang, baseY + thickness + rise, cz - overhang,
        cx + w + overhang, baseY + thickness + rise, cz - overhang,
        cx + w + overhang, baseY + thickness, cz + d + overhang,
        cx - overhang, baseY + thickness, cz + d + overhang,
    ]);

    const indices = [
        // Front
        0, 1, 5, 0, 5, 4,
        // Back
        2, 3, 7, 2, 7, 6,
        // Top
        4, 5, 6, 4, 6, 7,
        // Bottom
        0, 3, 2, 0, 2, 1,
        // Left
        0, 4, 7, 0, 7, 3,
        // Right
        1, 2, 6, 1, 6, 5,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
}

function buildApexRoof(cx, cz, w, d, baseY, overhang, thickness, mat) {
    const ridgeHeight = 0.6;
    const rw = w + overhang * 2;
    const rd = d + overhang * 2;

    // Left slope
    const leftVerts = new Float32Array([
        cx - overhang, baseY, cz - overhang,
        cx + w / 2, baseY + ridgeHeight, cz - overhang,
        cx + w / 2, baseY + ridgeHeight, cz + d + overhang,
        cx - overhang, baseY, cz + d + overhang,

        cx - overhang, baseY - thickness, cz - overhang,
        cx + w / 2, baseY + ridgeHeight - thickness, cz - overhang,
        cx + w / 2, baseY + ridgeHeight - thickness, cz + d + overhang,
        cx - overhang, baseY - thickness, cz + d + overhang,
    ]);

    const roofIndices = [
        0, 1, 2, 0, 2, 3,
        4, 6, 5, 4, 7, 6,
        0, 4, 5, 0, 5, 1,
        2, 6, 7, 2, 7, 3,
        0, 3, 7, 0, 7, 4,
        1, 5, 6, 1, 6, 2,
    ];

    const leftGeo = new THREE.BufferGeometry();
    leftGeo.setAttribute('position', new THREE.BufferAttribute(leftVerts, 3));
    leftGeo.setIndex(roofIndices);
    leftGeo.computeVertexNormals();
    const leftMesh = new THREE.Mesh(leftGeo, mat);
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    shedGroup.add(leftMesh);

    // Right slope
    const rightVerts = new Float32Array([
        cx + w / 2, baseY + ridgeHeight, cz - overhang,
        cx + w + overhang, baseY, cz - overhang,
        cx + w + overhang, baseY, cz + d + overhang,
        cx + w / 2, baseY + ridgeHeight, cz + d + overhang,

        cx + w / 2, baseY + ridgeHeight - thickness, cz - overhang,
        cx + w + overhang, baseY - thickness, cz - overhang,
        cx + w + overhang, baseY - thickness, cz + d + overhang,
        cx + w / 2, baseY + ridgeHeight - thickness, cz + d + overhang,
    ]);

    const rightGeo = new THREE.BufferGeometry();
    rightGeo.setAttribute('position', new THREE.BufferAttribute(rightVerts, 3));
    rightGeo.setIndex(roofIndices);
    rightGeo.computeVertexNormals();
    const rightMesh = new THREE.Mesh(rightGeo, mat);
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    shedGroup.add(rightMesh);

    // Gable triangles (front and back)
    const gableMat = createMaterial(WOOD_COLORS.spruce.wall, 0.75);

    for (const zPos of [cz, cz + d]) {
        const gableVerts = new Float32Array([
            cx, baseY, zPos,
            cx + w, baseY, zPos,
            cx + w / 2, baseY + ridgeHeight, zPos,
        ]);
        const gableGeo = new THREE.BufferGeometry();
        gableGeo.setAttribute('position', new THREE.BufferAttribute(gableVerts, 3));
        gableGeo.setIndex([0, 1, 2]);
        gableGeo.computeVertexNormals();
        const gableMesh = new THREE.Mesh(gableGeo, gableMat);
        gableMesh.castShadow = true;
        // Add back face too
        const gableGeo2 = gableGeo.clone();
        gableGeo2.setIndex([2, 1, 0]);
        gableGeo2.computeVertexNormals();
        const gableMesh2 = new THREE.Mesh(gableGeo2, gableMat);
        gableMesh2.castShadow = true;
        shedGroup.add(gableMesh);
        shedGroup.add(gableMesh2);
    }
}
