/**
 * ConfigPanel — Wires up all sidebar controls to update the shared state.
 * Also manages the openings list display.
 */
import state, { update, onChange, removeOpening, getAllOpenings, reset } from '../state.js';

export function init() {
    // Section toggle (collapse/expand)
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.panel-section').classList.toggle('collapsed');
        });
    });

    // Dimension sliders
    setupSlider('slider-width', 'val-width', 'width', 'mm');
    setupSlider('slider-depth', 'val-depth', 'depth', 'mm');
    setupSlider('slider-wallHeight', 'val-wallHeight', 'wallHeight', 'mm');

    // Wall thickness radios
    document.querySelectorAll('input[name="wallThickness"]').forEach(radio => {
        radio.addEventListener('change', () => {
            update({ wallThickness: parseInt(radio.value) });
            updateRadioVisuals('wall-thickness-group');
        });
    });

    // Wood type
    document.getElementById('select-wood').addEventListener('change', (e) => {
        update({ woodType: e.target.value });
    });

    // Roof type
    document.querySelectorAll('input[name="roofType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            update({ roofType: radio.value });
            updateRadioVisuals('roof-type-group');
        });
    });

    // Foundation
    document.querySelectorAll('input[name="foundation"]').forEach(radio => {
        radio.addEventListener('change', () => {
            update({ foundation: radio.value });
            updateRadioVisuals('foundation-group');
        });
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            update({ mode: btn.dataset.mode });
        });
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', () => {
        reset();
        syncUIFromState(state);
    });

    // Listen for state changes to update openings list
    onChange(renderOpeningsList);
}

function setupSlider(sliderId, valueId, stateKey, unit) {
    const slider = document.getElementById(sliderId);
    const valueEl = document.getElementById(valueId);

    slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        valueEl.textContent = val + unit;
        update({ [stateKey]: val });
    });

    // Also listen for state changes to sync slider (e.g. from blueprint drag)
    onChange((s) => {
        const val = s[stateKey];
        if (parseInt(slider.value) !== val) {
            slider.value = val;
            valueEl.textContent = val + unit;
        }
    });
}

function updateRadioVisuals(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.radio-card').forEach(card => {
        const input = card.querySelector('input');
        card.classList.toggle('active', input.checked);
    });
}

function renderOpeningsList(s) {
    const container = document.getElementById('openings-list');
    const openings = getAllOpenings();

    if (openings.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = openings.map(o => `
    <div class="opening-item" data-wall="${o.wall}" data-id="${o.id}">
      <div class="opening-info">
        <span class="opening-type">${o.type === 'door' ? '🚪' : '🪟'} ${o.type}</span>
        <span class="opening-wall">${o.wall} wall · ${o.width}mm</span>
      </div>
      <button class="opening-delete" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

    // Wire delete buttons
    container.querySelectorAll('.opening-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.currentTarget.closest('.opening-item');
            const wall = item.dataset.wall;
            const id = parseFloat(item.dataset.id);
            removeOpening(wall, id);
        });
    });
}

/** Sync all UI controls to match the current state (used after reset) */
function syncUIFromState(s) {
    // Sliders
    document.getElementById('slider-width').value = s.width;
    document.getElementById('val-width').textContent = s.width + 'mm';
    document.getElementById('slider-depth').value = s.depth;
    document.getElementById('val-depth').textContent = s.depth + 'mm';
    document.getElementById('slider-wallHeight').value = s.wallHeight;
    document.getElementById('val-wallHeight').textContent = s.wallHeight + 'mm';

    // Radios
    document.querySelector(`input[name="wallThickness"][value="${s.wallThickness}"]`).checked = true;
    updateRadioVisuals('wall-thickness-group');
    document.querySelector(`input[name="roofType"][value="${s.roofType}"]`).checked = true;
    updateRadioVisuals('roof-type-group');
    document.querySelector(`input[name="foundation"][value="${s.foundation}"]`).checked = true;
    updateRadioVisuals('foundation-group');

    // Select
    document.getElementById('select-wood').value = s.woodType;

    // Mode
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mode-btn[data-mode="${s.mode}"]`).classList.add('active');
}
