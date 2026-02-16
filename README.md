# 3D Viewer 360

Interactive 3D model viewer built with [Google Model Viewer](https://modelviewer.dev/) and real-time post-processing effects.

## Live Demo

[https://akmaltong.github.io/3D-Viewer-360/](https://akmaltong.github.io/3D-Viewer-360/)

## Features

- **Real-time bloom** via `<effect-composer>` + `<bloom-effect>` post-processing
- **Color grading** with ACES Filmic tonemapping
- **Dynamic model loading** - load .glb/.gltf files or from URL
- **Dynamic environment** - load .hdr files or from URL
- **Hotspot system** - interactive points of interest with camera fly-to
- **Hotspot editor** - drag gizmo for 3D positioning, camera save per hotspot
- **Material controls** - metalness, roughness, neon color/intensity
- **Video textures** - apply video to screen materials
- **Export** - JSON export of all hotspots, camera, model and environment data
- **Z-fighting fix** - improved near clip plane ratio for better depth precision
- **Idle auto-return** - camera returns to default view after 20s of inactivity

## Tech Stack

- `@google/model-viewer` 4.1.0
- `@google/model-viewer-effects` 1.5.0
- `three.js` 0.172.0
- All dependencies loaded via CDN (no build step required)

## Usage

Open `index.html` in a browser via any HTTP server:

```bash
npx http-server . -p 8080
```

### Integration with 360 Tour

The viewer is designed to be embedded in a 360 tour application. Load models dynamically:

```javascript
// From parent app
const viewer = document.querySelector('#viewer');
viewer.src = 'path/to/model.glb';
viewer.environmentImage = 'path/to/environment.hdr';
```

Or use the built-in editor (Settings > Editor tab) to load models via file picker or URL.

## Controls

| Button | Action |
|--------|--------|
| Home | Reset camera to default position |
| Hotspots | Toggle points of interest |
| Settings | Open settings panel |

### Settings Tabs

- **Material** - video, neon, bloom, surface, lighting controls
- **Editor** - hotspot positioning, model/environment loading, camera export
- **Zones** - toggles for hotspots, dimensions, rotation

## License

ISC
