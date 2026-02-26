/**
 * ConfigPanel — Sidebar controls, opening editor with door types and dimension editing.
 */
import state, {
    update, onChange, removeOpening, selectOpening, updateOpening,
    getAllOpenings, reset, DOOR_TYPES, WINDOW_TYPES
} from '../state.js';

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

    // Listen for state changes
    onChange(renderOpeningsPanel);
}

function setupSlider(sliderId, valueId, stateKey, unit) {
    const slider = document.getElementById(sliderId);
    const valueEl = document.getElementById(valueId);

    slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        valueEl.textContent = val + unit;
        update({ [stateKey]: val });
    });

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

function renderOpeningsPanel(s) {
    const container = document.getElementById('openings-list');
    const openings = getAllOpenings();

    let html = '';

    for (const o of openings) {
        const isSelected = s.selectedOpening?.wall === o.wall && s.selectedOpening?.id === o.id;

        html += `
      <div class="opening-item ${isSelected ? 'selected' : ''}"
           data-wall="${o.wall}" data-id="${o.id}">
        <div class="opening-info">
          <span class="opening-type">${o.type === 'door' ? '🚪' : '🪟'} ${o.subType || o.type}</span>
          <span class="opening-wall">${o.wall} · ${o.width}×${o.height}mm</span>
        </div>
        <div class="opening-actions">
          <button class="opening-delete" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;

        // Inline editor for selected opening
        if (isSelected) {
            const types = o.type === 'door' ? DOOR_TYPES : WINDOW_TYPES;
            const typeOptions = Object.entries(types).map(([key, val]) =>
                `<option value="${key}" ${key === o.subType ? 'selected' : ''}>${val.label}</option>`
            ).join('');

            html += `
        <div class="opening-editor" data-wall="${o.wall}" data-id="${o.id}">
          <div class="editor-title">Edit ${o.type}</div>
          <div class="editor-row">
            <label>Type</label>
            <select class="edit-subtype">${typeOptions}</select>
          </div>
          <div class="editor-row">
            <label>W</label>
            <input type="number" class="edit-width" value="${o.width}" min="400" max="3000" step="50" />
            <label>H</label>
            <input type="number" class="edit-height" value="${o.height}" min="400" max="2500" step="50" />
          </div>
          ${o.type === 'window' ? `
          <div class="editor-row">
            <label>Y↑</label>
            <input type="number" class="edit-yoffset" value="${o.yOffset || 0}" min="0" max="1500" step="50" />
          </div>` : ''}
        </div>
      `;
        }
    }

    if (openings.length === 0) {
        html = '';
    }

    container.innerHTML = html;

    // Wire events
    container.querySelectorAll('.opening-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.opening-delete')) return;
            const wall = item.dataset.wall;
            const id = parseFloat(item.dataset.id);
            const isAlreadySelected = state.selectedOpening?.wall === wall && state.selectedOpening?.id === id;
            selectOpening(wall, isAlreadySelected ? null : id);
        });
    });

    container.querySelectorAll('.opening-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.currentTarget.closest('.opening-item');
            removeOpening(item.dataset.wall, parseFloat(item.dataset.id));
        });
    });

    // Wire editor inputs
    container.querySelectorAll('.opening-editor').forEach(editor => {
        const wall = editor.dataset.wall;
        const id = parseFloat(editor.dataset.id);

        const subtypeSelect = editor.querySelector('.edit-subtype');
        if (subtypeSelect) {
            subtypeSelect.addEventListener('change', () => {
                updateOpening(wall, id, { subType: subtypeSelect.value });
            });
        }

        const widthInput = editor.querySelector('.edit-width');
        if (widthInput) {
            widthInput.addEventListener('change', () => {
                updateOpening(wall, id, { width: parseInt(widthInput.value) || 600 });
            });
        }

        const heightInput = editor.querySelector('.edit-height');
        if (heightInput) {
            heightInput.addEventListener('change', () => {
                updateOpening(wall, id, { height: parseInt(heightInput.value) || 800 });
            });
        }

        const yoffsetInput = editor.querySelector('.edit-yoffset');
        if (yoffsetInput) {
            yoffsetInput.addEventListener('change', () => {
                updateOpening(wall, id, { yOffset: parseInt(yoffsetInput.value) || 0 });
            });
        }
    });
}

function syncUIFromState(s) {
    document.getElementById('slider-width').value = s.width;
    document.getElementById('val-width').textContent = s.width + 'mm';
    document.getElementById('slider-depth').value = s.depth;
    document.getElementById('val-depth').textContent = s.depth + 'mm';
    document.getElementById('slider-wallHeight').value = s.wallHeight;
    document.getElementById('val-wallHeight').textContent = s.wallHeight + 'mm';

    document.querySelector(`input[name="wallThickness"][value="${s.wallThickness}"]`).checked = true;
    updateRadioVisuals('wall-thickness-group');
    document.querySelector(`input[name="roofType"][value="${s.roofType}"]`).checked = true;
    updateRadioVisuals('roof-type-group');
    document.querySelector(`input[name="foundation"][value="${s.foundation}"]`).checked = true;
    updateRadioVisuals('foundation-group');

    document.getElementById('select-wood').value = s.woodType;

    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mode-btn[data-mode="${s.mode}"]`)?.classList.add('active');
}
