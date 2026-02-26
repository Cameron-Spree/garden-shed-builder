# Garden Shed Builder 🏡

Interactive garden shed configurator with a **2D blueprint editor** and **real-time 3D preview**.

![screenshot](https://img.shields.io/badge/status-v1-brightgreen)

## Features

- 🏗️ **2D Blueprint Editor** — Top-down floor plan with drag handles to resize
- 🎮 **3D Live Preview** — Three.js rendered shed with orbit controls
- 🚪 **Doors & Windows** — Click walls to place openings; shown in both views
- 🎨 **Configuration Panel** — Wall thickness, wood type, roof style, foundation
- 🌙 **Dark Premium Theme** — Glassmorphism, smooth animations, Inter font
- 📱 **Responsive** — Stacks panels on narrow screens

## Quick Start

```bash
# In GitHub Codespace or locally with Node:
npm run dev

# Or just serve the directory:
npx serve .
```

Then open the URL shown in the terminal.

## Tech Stack

- **Vanilla JS** with ES modules
- **Three.js** (CDN via importmap — no build step)
- **HTML Canvas** for 2D blueprint
- **CSS** with custom properties and glassmorphism

## Usage

1. Use the **sliders** in the left panel to set Width, Depth, and Wall Height
2. **Drag the handles** on the 2D blueprint to resize interactively
3. Switch to **Door** or **Window** mode in the toolbar, then click a wall to place
4. Toggle between **Pent** and **Apex** roof styles
5. Choose your **wood type** and **foundation** material
6. Orbit the 3D view to inspect from any angle

## License

MIT
