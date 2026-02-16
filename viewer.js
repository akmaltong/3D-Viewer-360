document.addEventListener('DOMContentLoaded', function() {
    var viewer = document.querySelector('#viewer');
    if (!viewer) { console.error('viewer not found'); return; }
    console.log('DOM ready, viewer found');

    function init() {
        console.log('model-viewer init started');

        // 1. Hotspot camera views
        viewer.querySelectorAll('.hotspot').forEach(function(hs) {
            hs.addEventListener('click', function() {
                if (hs.dataset.orbit) viewer.cameraOrbit = hs.dataset.orbit;
                if (hs.dataset.target) viewer.cameraTarget = hs.dataset.target;
                viewer.fieldOfView = '45deg';
                console.log('hotspot clicked:', hs.slot);
            });
        });

        // 2. Dimensions
        var dimElements = viewer.querySelectorAll('.dim-dot, .dim-label');
        var dimSvg = viewer.querySelector('#dimLines');
        var dimLines = viewer.querySelectorAll('.dim-line');
        var dimsVisible = false;

        function setDimsVisible(show) {
            dimsVisible = show;
            dimElements.forEach(function(el) { el.classList.toggle('hide', !show); });
            if (dimSvg) dimSvg.classList.toggle('hide', !show);
        }
        setDimsVisible(false);

        function drawLine(svgLine, slot1, slot2) {
            if (!viewer.queryHotspot) return;
            var h1 = viewer.queryHotspot(slot1);
            var h2 = viewer.queryHotspot(slot2);
            if (h1 && h2) {
                svgLine.setAttribute('x1', h1.canvasPosition.x);
                svgLine.setAttribute('y1', h1.canvasPosition.y);
                svgLine.setAttribute('x2', h2.canvasPosition.x);
                svgLine.setAttribute('y2', h2.canvasPosition.y);
            }
        }

        function renderDimLines() {
            if (!dimsVisible) return;
            drawLine(dimLines[0], 'hotspot-dim-y-top', 'hotspot-dim-y-bot');
            drawLine(dimLines[1], 'hotspot-dim-x-left', 'hotspot-dim-x-right');
        }

        viewer.addEventListener('load', function() {
            console.log('model loaded');
            if (!viewer.getDimensions) { console.warn('getDimensions not available'); return; }
            var size = viewer.getDimensions();
            var center = viewer.getBoundingBoxCenter();
            var x2 = size.x / 2, y2 = size.y / 2;

            viewer.updateHotspot({ name: 'hotspot-dim-y-top', position: (center.x+x2+0.1)+' '+(center.y+y2)+' '+center.z });
            viewer.updateHotspot({ name: 'hotspot-dim-y-bot', position: (center.x+x2+0.1)+' '+(center.y-y2)+' '+center.z });
            viewer.updateHotspot({ name: 'hotspot-dim-y-label', position: (center.x+x2+0.25)+' '+center.y+' '+center.z });
            var yLabel = viewer.querySelector('button[slot="hotspot-dim-y-label"]');
            if (yLabel) yLabel.textContent = (size.y*100).toFixed(0)+' cm';

            viewer.updateHotspot({ name: 'hotspot-dim-x-left', position: (center.x-x2)+' '+(center.y-y2-0.05)+' '+center.z });
            viewer.updateHotspot({ name: 'hotspot-dim-x-right', position: (center.x+x2)+' '+(center.y-y2-0.05)+' '+center.z });
            viewer.updateHotspot({ name: 'hotspot-dim-x-label', position: center.x+' '+(center.y-y2-0.15)+' '+center.z });
            var xLabel = viewer.querySelector('button[slot="hotspot-dim-x-label"]');
            if (xLabel) xLabel.textContent = (size.x*100).toFixed(0)+' cm';

            renderDimLines();
            console.log('dimensions set:', size);
        });

        viewer.addEventListener('camera-change', renderDimLines);

        // 3. Skybox rotation (Shift+drag)
        var lastX = 0, panning = false, skyboxAngle = 0, radiansPerPixel = 0;

        viewer.addEventListener('mousedown', function(e) {
            panning = e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
            if (!panning) return;
            lastX = e.clientX;
            if (viewer.getCameraOrbit) {
                var orbit = viewer.getCameraOrbit();
                radiansPerPixel = -1 * orbit.radius / viewer.getBoundingClientRect().height;
            }
            e.stopPropagation();
        }, true);

        window.addEventListener('mousemove', function(e) {
            if (!panning) return;
            var delta = (e.clientX - lastX) * radiansPerPixel;
            lastX = e.clientX;
            skyboxAngle += delta;
            if (viewer.getCameraOrbit) {
                var orbit = viewer.getCameraOrbit();
                orbit.theta += delta;
                viewer.cameraOrbit = orbit.toString();
                viewer.resetTurntableRotation(skyboxAngle);
                viewer.jumpCameraToGoal();
            }
            e.stopPropagation();
        }, true);

        window.addEventListener('mouseup', function() { panning = false; }, true);

        // 4. Toolbar
        var hotspotsVisible = true;

        document.getElementById('btn-dimensions').onclick = function() {
            var active = this.classList.toggle('active');
            setDimsVisible(active);
            if (active) renderDimLines();
            console.log('dimensions:', active);
        };

        document.getElementById('btn-hotspots').onclick = function() {
            hotspotsVisible = !hotspotsVisible;
            this.classList.toggle('active', hotspotsVisible);
            viewer.querySelectorAll('.hotspot').forEach(function(h) {
                h.classList.toggle('hide', !hotspotsVisible);
            });
            console.log('hotspots:', hotspotsVisible);
        };

        document.getElementById('btn-lighting').onclick = function() {
            this.classList.toggle('active');
            document.getElementById('lighting-panel').classList.toggle('hidden');
            document.getElementById('skybox-panel').classList.add('hidden');
            document.getElementById('btn-skybox').classList.remove('active');
        };

        document.getElementById('btn-skybox').onclick = function() {
            this.classList.toggle('active');
            document.getElementById('skybox-panel').classList.toggle('hidden');
            document.getElementById('lighting-panel').classList.add('hidden');
            document.getElementById('btn-lighting').classList.remove('active');
        };

        document.getElementById('btn-fullscreen').onclick = function() {
            if (!document.fullscreenElement) {
                document.getElementById('app').requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        };

        // 5. Lighting
        document.querySelectorAll('input[name="env"]').forEach(function(r) {
            r.onchange = function() { viewer.environmentImage = r.value; };
        });
        document.getElementById('shadow-range').oninput = function() {
            viewer.shadowIntensity = parseFloat(this.value);
        };

        // 6. Skybox
        document.querySelectorAll('input[name="sky"]').forEach(function(r) {
            r.onchange = function() { viewer.skyboxImage = r.value; };
        });
        document.getElementById('skybox-height').oninput = function() {
            viewer.skyboxHeight = this.value + 'm';
            document.getElementById('skybox-height-val').textContent = this.value + 'm';
        };

        console.log('All controls initialized!');
    }

    // Try init immediately, or wait for custom element
    if (viewer.updateHotspot) {
        init();
    } else {
        customElements.whenDefined('model-viewer').then(init);
    }
});
