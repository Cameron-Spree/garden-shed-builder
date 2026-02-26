/**
 * SceneManager — Sets up and manages the Three.js scene, camera, lights, and renderer.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, container;
let animationId;

export function init(containerEl) {
    container = containerEl;

    // Scene
    scene = new THREE.Scene();

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Camera
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(6, 5, 8);
    camera.lookAt(0, 1, 0);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 1, 0);

    // Lighting
    setupLights();

    // Ground
    setupGround();

    // Resize
    resizeRenderer();
    window.addEventListener('resize', resizeRenderer);

    // Animation loop
    animate();
}

function setupLights() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    // Hemisphere light (sky/ground)
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a5f3a, 0.4);
    scene.add(hemi);

    // Main directional light (sun)
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.0001;
    scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0xbdd7ff, 0.3);
    fill.position.set(-4, 6, -4);
    scene.add(fill);
}

function setupGround() {
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4a8c5c,
        roughness: 0.9,
        metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Foundation slab area (drawn dynamically in ShedBuilder)
}

function resizeRenderer() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

export function getScene() {
    return scene;
}

export function resetCamera() {
    camera.position.set(6, 5, 8);
    controls.target.set(0, 1, 0);
    controls.update();
}
