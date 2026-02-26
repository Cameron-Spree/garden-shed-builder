/**
 * main.js — Entry point. Wires together all modules.
 */
import state, { onChange } from './state.js';
import { init as initBlueprint, draw as drawBlueprint } from './blueprint/BlueprintEditor.js';
import { init as initScene } from './preview/SceneManager.js';
import { build as buildShed } from './preview/ShedBuilder.js';
import { init as initConfigPanel } from './ui/ConfigPanel.js';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    // Init config panel (sidebar controls)
    initConfigPanel();

    // Init 2D blueprint
    const blueprintCanvas = document.getElementById('blueprint-canvas');
    initBlueprint(blueprintCanvas);

    // Init 3D scene
    const threeContainer = document.getElementById('three-container');
    initScene(threeContainer);

    // Build initial shed
    buildShed(state);

    // Listen for state changes → update both views
    onChange((s) => {
        drawBlueprint(s);
        buildShed(s);
    });

    // Initial draw
    drawBlueprint(state);
});
