import * as THREE from 'three';

document.addEventListener('DOMContentLoaded', function() {
    var viewer = document.querySelector('#viewer');
    if (!viewer) { console.error('viewer not found'); return; }

    var currentVideoTexture = null;
    var screenMaterial = null;
    var neonMaterials = [];
    var allMaterials = [];
    var editMode = false;
    var screenMode = false;

    // Force disable mobile tap highlight on viewer and all children
    viewer.style.webkitTapHighlightColor = 'transparent';
    viewer.style.webkitTouchCallout = 'none';
    viewer.style.userSelect = 'none';
    document.getElementById('app').style.webkitTapHighlightColor = 'transparent';

    // Inject styles into model-viewer shadow DOM to kill blue highlight
    function injectShadowStyles() {
        var shadow = viewer.shadowRoot;
        if (!shadow) return;
        var style = document.createElement('style');
        style.textContent = '*, *::before, *::after { -webkit-tap-highlight-color: transparent !important; outline: none !important; -webkit-touch-callout: none !important; user-select: none !important; -webkit-user-select: none !important; } :focus { outline: none !important; } ::selection { background: transparent !important; }';
        shadow.appendChild(style);
    }
    if (viewer.shadowRoot) {
        injectShadowStyles();
    } else {
        // Wait for shadow root to be available
        var obs = new MutationObserver(function() {
            if (viewer.shadowRoot) { injectShadowStyles(); obs.disconnect(); }
        });
        obs.observe(viewer, { childList: true, subtree: true });
        // Fallback
        setTimeout(injectShadowStyles, 1000);
    }

    // Prevent default on touchstart on the viewer to stop blue flash
    viewer.addEventListener('touchstart', function() {
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
    }, { passive: true });

    // Screen mode hint element
    // Screen mode hint — now a clickable button for switching video
    var screenModeHint = document.createElement('button');
    screenModeHint.id = 'screen-mode-hint';
    screenModeHint.textContent = '⟳ СМЕНИТЬ ВИДЕО';
    screenModeHint.style.display = 'none';
    document.getElementById('app').appendChild(screenModeHint);

    function setScreenMode(on) {
        screenMode = on;
        screenModeHint.style.display = on ? '' : 'none';
        // Camera controls stay enabled — no blocking
    }

    var defaultOrbit = '-101.7deg 93.0deg 15.00m';
    var defaultTarget = '0.16m 1.88m 0.02m';

    // === FLOOR CLAMP: prevent camera from seeing disc underside ===
    var FLOOR_Y = -0.2;
    viewer.addEventListener('camera-change', function() {
        var orbit = viewer.getCameraOrbit();
        var target = viewer.getCameraTarget();
        var camY = target.y + orbit.radius * Math.cos(orbit.phi);
        if (camY < FLOOR_Y) {
            var ratio = Math.max(-1, Math.min(1, (FLOOR_Y - target.y) / orbit.radius));
            var maxPhi = Math.acos(ratio);
            viewer.setAttribute('camera-orbit', orbit.theta + 'rad ' + maxPhi + 'rad ' + orbit.radius + 'm');
        }
    });

    // === IDLE TIMER: return camera after 20s ===
    var idleTimer = null;
    var IDLE_TIMEOUT = 20000;

    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function() {
            if (!editMode) {
                viewer.cameraOrbit = defaultOrbit;
                viewer.cameraTarget = defaultTarget;
                setScreenMode(false);
            }
        }, IDLE_TIMEOUT);
    }

    viewer.addEventListener('camera-change', resetIdleTimer);
    viewer.addEventListener('pointerdown', resetIdleTimer);
    viewer.addEventListener('pointerup', resetIdleTimer);
    viewer.addEventListener('wheel', resetIdleTimer);
    document.addEventListener('keydown', resetIdleTimer);

    function init() {
        resetIdleTimer();

        // === BOTTOM BAR ===
        var settingsPanel = document.getElementById('settings-panel');
        var barSettings = document.getElementById('bar-settings');

        // Home: reset camera + toggle edit mode off
        document.getElementById('bar-home').onclick = function() {
            viewer.cameraOrbit = defaultOrbit;
            viewer.cameraTarget = defaultTarget;
            setScreenMode(false);
            resetIdleTimer();
        };

        // Hotspots: toggle hotspot visibility
        var hotspotsVisible = false;
        document.getElementById('bar-hotspots').onclick = function() {
            hotspotsVisible = !hotspotsVisible;
            this.classList.toggle('active', hotspotsVisible);
            viewer.querySelectorAll('.hotspot').forEach(function(h) { h.classList.toggle('hide', !hotspotsVisible); });
            document.getElementById('hotspot-nav').style.display = hotspotsVisible ? '' : 'none';
        };

        // Settings: toggle panel
        barSettings.onclick = function() {
            var isHidden = settingsPanel.classList.contains('hidden');
            settingsPanel.classList.toggle('hidden', !isHidden);
            barSettings.classList.toggle('active', isHidden);
        };

        // === TAB SYSTEM ===
        var tabBtns = document.querySelectorAll('.tab-btn[data-tab]');
        var tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tabId = btn.dataset.tab;
                tabBtns.forEach(function(b) { b.classList.remove('active'); });
                tabContents.forEach(function(tc) { tc.classList.remove('active'); });
                btn.classList.add('active');
                var target = document.getElementById(tabId);
                if (target) target.classList.add('active');

                // Toggle edit mode based on tab
                var wasEdit = editMode;
                editMode = (tabId === 'tab-editor');
                if (editMode && !wasEdit) {
                    viewer.querySelectorAll('.hotspot').forEach(function(hs) {
                        hs.style.outline = '2px solid yellow';
                        hs.style.zIndex = '200';
                    });
                    document.getElementById('hotspot-nav').style.display = 'none';
                } else if (!editMode && wasEdit) {
                    viewer.querySelectorAll('.hotspot').forEach(function(hs) {
                        hs.style.outline = '';
                        hs.style.zIndex = '';
                    });
                    document.getElementById('hotspot-nav').style.display = hotspotsVisible ? '' : 'none';
                    selectedHotspot = null;
                    hideGizmo();
                }
            });
        });

        // === RESET ALL ===
        document.getElementById('btn-reset-all').onclick = function() {
            viewer.cameraOrbit = defaultOrbit;
            viewer.cameraTarget = defaultTarget;
            viewer.environmentImage = 'studio_small_01_1k.hdr';
            viewer.shadowIntensity = 2.5;
            viewer.setAttribute('exposure', 1.1);
            viewer.exposure = 1.1;
            viewer.removeAttribute('auto-rotate');
            setSlider('video-intensity', 4.3, 'video-int-val');
            setSlider('neon-intensity', 20.5, 'neon-val');
            setSlider('bloom-slider', 0.09, 'bloom-val', true);
            setSlider('mat-metalness', 0, 'mat-metalness-val', true);
            setSlider('mat-roughness', 0, 'mat-roughness-val', true);
            setSlider('shadow-range', 2.5, 'shadow-val');
            setSlider('exposure-range', 1.1, 'exposure-val');
            document.getElementById('neon-color').value = '#0055ff';
            document.getElementById('hdri-select').value = 'photo_studio_broadway_hall_1k.hdr';
            document.getElementById('video-select').selectedIndex = 1;
            document.getElementById('neon-color').dispatchEvent(new Event('input'));
            document.getElementById('neon-intensity').dispatchEvent(new Event('input'));
            document.getElementById('mat-metalness').dispatchEvent(new Event('input'));
            document.getElementById('mat-roughness').dispatchEvent(new Event('input'));
            document.getElementById('bloom-slider').dispatchEvent(new Event('input'));
            // Reset background
            document.getElementById('toggle-light-bg').checked = false;
            document.getElementById('toggle-light-bg').dispatchEvent(new Event('change'));
            document.getElementById('toggle-skybox').checked = true;
            document.getElementById('toggle-skybox').dispatchEvent(new Event('change'));
            setSlider('skybox-blur', 0.2, 'skybox-blur-val');
            document.getElementById('skybox-blur').dispatchEvent(new Event('input'));
            resetIdleTimer();
        };

        function setSlider(id, val, labelId, twoDecimals) {
            var el = document.getElementById(id);
            if (el) el.value = val;
            var lab = document.getElementById(labelId);
            if (lab) lab.textContent = twoDecimals ? val.toFixed(2) : val;
        }

        // === Hotspot click → fly camera ===
        viewer.querySelectorAll('.hotspot').forEach(function(hs, idx) {
            hs.addEventListener('click', function(e) {
                if (editMode) { e.stopPropagation(); return; }
                if (hs.dataset.orbit) viewer.cameraOrbit = hs.dataset.orbit;
                if (hs.dataset.target) viewer.cameraTarget = hs.dataset.target;
                setScreenMode(idx === 0); // Экран (hotspot-1) activates screen mode
                resetIdleTimer();
            });
        });

        // === Right nav → fly to hotspot ===
        document.querySelectorAll('#hotspot-nav .nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                if (editMode) return;
                var idx = parseInt(item.dataset.index);
                var hs = viewer.querySelector('.hotspot[slot="hotspot-' + (idx + 1) + '"]');
                if (hs) {
                    if (hs.dataset.orbit) viewer.cameraOrbit = hs.dataset.orbit;
                    if (hs.dataset.target) viewer.cameraTarget = hs.dataset.target;
                }
                setScreenMode(idx === 0); // ЭКРАН activates screen mode
                resetIdleTimer();
            });
        });

        // === Dimensions ===
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
            var h1 = viewer.queryHotspot(slot1), h2 = viewer.queryHotspot(slot2);
            if (h1 && h2) {
                svgLine.setAttribute('x1', h1.canvasPosition.x); svgLine.setAttribute('y1', h1.canvasPosition.y);
                svgLine.setAttribute('x2', h2.canvasPosition.x); svgLine.setAttribute('y2', h2.canvasPosition.y);
            }
        }
        function renderDimLines() {
            if (!dimsVisible) return;
            drawLine(dimLines[0], 'hotspot-dim-y-top', 'hotspot-dim-y-bot');
            drawLine(dimLines[1], 'hotspot-dim-x-left', 'hotspot-dim-x-right');
        }
        viewer.addEventListener('camera-change', renderDimLines);

        // === ZONES TAB toggles ===
        document.getElementById('toggle-hotspots').onchange = function() {
            hotspotsVisible = this.checked;
            document.getElementById('bar-hotspots').classList.toggle('active', hotspotsVisible);
            viewer.querySelectorAll('.hotspot').forEach(function(h) { h.classList.toggle('hide', !hotspotsVisible); });
            document.getElementById('hotspot-nav').style.display = hotspotsVisible ? '' : 'none';
        };
        document.getElementById('toggle-dimensions').onchange = function() {
            dimsVisible = this.checked;
            setDimsVisible(dimsVisible);
            if (dimsVisible) renderDimLines();
        };
        document.getElementById('toggle-rotation').onchange = function() {
            if (this.checked) viewer.setAttribute('auto-rotate', '');
            else viewer.removeAttribute('auto-rotate');
        };

        document.getElementById('resetCameraBtn').onclick = function() {
            viewer.cameraOrbit = defaultOrbit; viewer.cameraTarget = defaultTarget;
            resetIdleTimer();
        };
        document.getElementById('screenshotBtn').onclick = function() {
            viewer.toBlob({idealAspect: true}).then(function(b) {
                var a = document.createElement('a');
                a.download = 'vtb-' + new Date().toISOString().replace(/[:.]/g,'-') + '.png';
                a.href = URL.createObjectURL(b); a.click();
            });
        };

        // === Video ===
        document.getElementById('video-select').onchange = function() { applyVideoTexture(this.value); };
        document.getElementById('video-intensity').oninput = function() {
            document.getElementById('video-int-val').textContent = this.value;
            if (screenMaterial) {
                var v = parseFloat(this.value);
                screenMaterial.pbrMetallicRoughness.setBaseColorFactor([v, v, v, 1]);
            }
        };
        // dblclick on screen area — disabled, use button instead
        // viewer.addEventListener('dblclick', ...);

        // === Video switch button (screen-mode-hint) ===
        screenModeHint.addEventListener('click', function(e) {
            e.stopPropagation();
            var sel = document.getElementById('video-select');
            sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
            applyVideoTexture(sel.value);
            resetIdleTimer();
        });

        // === Detect if click/tap hit the screen material ===
        function isClickOnScreen(e) {
            try {
                var symbols = Object.getOwnPropertySymbols(viewer);
                var sceneSymbol = symbols.find(function(s) { return s.description === 'scene'; });
                if (sceneSymbol) {
                    var scene = viewer[sceneSymbol];
                    var camera = scene.getCamera();
                    var rect = viewer.getBoundingClientRect();
                    var mouse = new THREE.Vector2(
                        ((e.clientX - rect.left) / rect.width) * 2 - 1,
                        -((e.clientY - rect.top) / rect.height) * 2 + 1
                    );
                    var raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(mouse, camera);
                    var intersects = raycaster.intersectObjects(scene.children, true);
                    if (intersects.length > 0) {
                        var mat = intersects[0].object.material;
                        if (mat) {
                            var name = (mat.name || '').toLowerCase();
                            return (name.includes('video') || name.includes('screen') || name.includes('display') || name.includes('monitor'));
                        }
                    }
                }
            } catch(err) {
                console.warn('Raycast failed:', err);
            }
            return false;
        }

        // No more click-to-switch on viewer — only the button switches video
        var viewerPointerDown = false;
        var viewerDragMoved = false;
        viewer.addEventListener('pointerdown', function() { viewerPointerDown = true; viewerDragMoved = false; });
        viewer.addEventListener('pointermove', function() { if (viewerPointerDown) viewerDragMoved = true; });
        viewer.addEventListener('pointerup', function() { viewerPointerDown = false; });

        // === Neon color ===
        document.getElementById('neon-color').oninput = function() {
            var hex = this.value;
            var r = parseInt(hex.substr(1,2),16)/255;
            var g = parseInt(hex.substr(3,2),16)/255;
            var b = parseInt(hex.substr(5,2),16)/255;
            console.log('Setting neon color:', r.toFixed(2), g.toFixed(2), b.toFixed(2), 'on', neonMaterials.length, 'materials');
            neonMaterials.forEach(function(mat) {
                try { mat.setEmissiveFactor([r, g, b]); } catch(e) { console.warn('setEmissiveFactor failed:', e); }
            });
        };
        document.getElementById('neon-intensity').oninput = function() {
            var val = parseFloat(this.value);
            document.getElementById('neon-val').textContent = val;
            neonMaterials.forEach(function(mat) {
                try { mat.setEmissiveStrength(val); } catch(e) { console.warn('setEmissiveStrength failed:', e); }
            });
        };

        // === Bloom (real post-processing via <bloom-effect>) ===
        var bloomEffect = document.getElementById('bloom-effect');
        var bloomValue = 0.1;
        document.getElementById('bloom-slider').oninput = function() {
            bloomValue = parseFloat(this.value);
            document.getElementById('bloom-val').textContent = bloomValue.toFixed(2);
            applyBloom();
        };
        function applyBloom() {
            if (bloomEffect) {
                bloomEffect.setAttribute('strength', bloomValue.toFixed(3));
            }
        }

        // === Metalness / Roughness ===
        document.getElementById('mat-metalness').oninput = function() {
            var val = parseFloat(this.value);
            document.getElementById('mat-metalness-val').textContent = val.toFixed(2);
            applyGlobalMaterial('metalness', val);
        };
        document.getElementById('mat-roughness').oninput = function() {
            var val = parseFloat(this.value);
            document.getElementById('mat-roughness-val').textContent = val.toFixed(2);
            applyGlobalMaterial('roughness', val);
        };
        function applyGlobalMaterial(prop, val) {
            allMaterials.forEach(function(mat) {
                var n = (mat.name || '').toLowerCase();
                if (n.includes('video') || n.includes('screen')) return;
                if (prop === 'metalness') mat.pbrMetallicRoughness.setMetallicFactor(val);
                else mat.pbrMetallicRoughness.setRoughnessFactor(val);
            });
        }

        // === HDRI / Shadow / Exposure ===
        document.getElementById('hdri-select').onchange = function() {
            viewer.environmentImage = this.value;
            // Update skybox if visible
            if (document.getElementById('toggle-skybox').checked) {
                viewer.skyboxImage = this.value || viewer.environmentImage;
            }
        };
        document.getElementById('shadow-range').oninput = function() {
            viewer.shadowIntensity = parseFloat(this.value);
            document.getElementById('shadow-val').textContent = this.value;
        };
        var colorGrade = document.getElementById('color-grade');
        document.getElementById('exposure-range').oninput = function() {
            var val = parseFloat(this.value);
            viewer.setAttribute('exposure', val);
            viewer.exposure = val;
            // Also adjust color-grade brightness: map exposure 0-3 to brightness -1..+1
            if (colorGrade) {
                var brightness = (val - 1) * 0.5; // exposure 1 = brightness 0
                colorGrade.setAttribute('brightness', Math.max(-1, Math.min(1, brightness)).toFixed(3));
            }
            document.getElementById('exposure-val').textContent = this.value;
        };

        // === FPS toggle ===
        var fpsEl = document.getElementById('fps-counter');
        var fpsOn = false;
        var frameCount = 0, lastFpsTime = performance.now();
        document.getElementById('toggle-fps').onchange = function() {
            fpsOn = this.checked;
            fpsEl.style.display = fpsOn ? 'block' : 'none';
        };

        // === Background controls ===
        var darkBg = '#0d1117';
        var lightBg = '#e8e8e8';
        document.getElementById('toggle-light-bg').onchange = function() {
            var isLight = this.checked;
            var color = isLight ? lightBg : darkBg;
            viewer.style.background = color;
            viewer.style.setProperty('--poster-color', color);
        };
        document.getElementById('toggle-skybox').onchange = function() {
            if (this.checked) {
                // Show HDRI as skybox
                var hdriVal = document.getElementById('hdri-select').value;
                viewer.skyboxImage = hdriVal || viewer.environmentImage;
                var blur = parseFloat(document.getElementById('skybox-blur').value) || 0;
                viewer.skyboxHeight = '0m';
                viewer.setAttribute('skybox-height', '0m');
            } else {
                viewer.skyboxImage = '';
                viewer.removeAttribute('skybox-image');
            }
        };
        document.getElementById('skybox-blur').oninput = function() {
            var val = parseFloat(this.value);
            document.getElementById('skybox-blur-val').textContent = val.toFixed(1);
            try {
                var symbols = Object.getOwnPropertySymbols(viewer);
                var sceneSymbol = symbols.find(function(s) { return s.description === 'scene'; });
                if (sceneSymbol) {
                    var scene = viewer[sceneSymbol];
                    scene.backgroundBlurriness = val;
                }
            } catch(e) { console.warn('Skybox blur error:', e); }
        };
        function updateFps() {
            if (fpsOn) {
                frameCount++;
                var now = performance.now();
                if (now - lastFpsTime >= 1000) {
                    fpsEl.textContent = 'FPS: ' + frameCount;
                    frameCount = 0; lastFpsTime = now;
                }
            }
            requestAnimationFrame(updateFps);
        }
        requestAnimationFrame(updateFps);

        // === Apply video texture ===
        // Lazy-cache video textures: created once on first use, reused on switch
        var videoTextureCache = {}; // videoFile -> texture
        var activeTextureVideo = null; // the <video> inside the active texture

        function applyVideoTexture(videoFile) {
            if (!screenMaterial || typeof viewer.createVideoTexture !== 'function') return;
            try {
                // Reuse cached texture or create once (lazy cache)
                var isNew = !videoTextureCache[videoFile];
                if (isNew) {
                    videoTextureCache[videoFile] = viewer.createVideoTexture(videoFile);
                }
                var newTexture = videoTextureCache[videoFile];

                // Get the internal video element
                var videoEl = null;
                try { videoEl = newTexture.source.element; } catch(e2) {}

                function doSwap() {
                    // Pause the previously active texture's internal video
                    if (activeTextureVideo && activeTextureVideo !== videoEl) {
                        activeTextureVideo.pause();
                    }
                    activeTextureVideo = videoEl;
                    currentVideoTexture = newTexture;
                    screenMaterial.pbrMetallicRoughness.baseColorTexture.setTexture(newTexture);

                    // Flip video texture horizontally (mirror UV) to fix mirrored text
                    try {
                        // Access Three.js texture via scene traversal
                        var symbols = Object.getOwnPropertySymbols(viewer);
                        var sceneSymbol = symbols.find(function(s) { return s.description === 'scene'; });
                        if (sceneSymbol) {
                            var scene = viewer[sceneSymbol];
                            scene.traverse(function(obj) {
                                if (obj.material) {
                                    var n = (obj.material.name || '').toLowerCase();
                                    if (n.includes('video') || n.includes('screen')) {
                                        var map = obj.material.map;
                                        if (map) {
                                            // Clamp texture to edge so it doesn't stretch beyond screen
                                            map.wrapS = THREE.ClampToEdgeWrapping;
                                            map.wrapT = THREE.ClampToEdgeWrapping;
                                            map.repeat.x = 1;
                                            map.offset.x = 0;
                                            map.repeat.y = -1;
                                            map.offset.y = 1;
                                            map.center.set(0, 0);
                                            map.rotation = 0;
                                            map.needsUpdate = true;
                                        }
                                    }
                                }
                            });
                        }
                    } catch(e3) { console.warn('UV flip failed:', e3); }

                    screenMaterial.pbrMetallicRoughness.setMetallicFactor(0);
                    screenMaterial.pbrMetallicRoughness.setRoughnessFactor(1);
                    var vInt = parseFloat(document.getElementById('video-intensity').value);
                    screenMaterial.pbrMetallicRoughness.setBaseColorFactor([vInt, vInt, vInt, 1]);
                    console.log('Video applied: ' + videoFile);
                }

                if (!isNew && videoEl) {
                    // Cached: restart and swap immediately (already has frames)
                    videoEl.currentTime = 0;
                    videoEl.play().catch(function() {});
                    doSwap();
                } else if (videoEl) {
                    // New texture: wait for first frame before swapping to avoid black flash
                    if (videoEl.readyState >= 2) {
                        doSwap();
                    } else {
                        videoEl.addEventListener('loadeddata', function onReady() {
                            videoEl.removeEventListener('loadeddata', onReady);
                            doSwap();
                        });
                        // Fallback: swap after 500ms even if not ready
                        setTimeout(doSwap, 500);
                    }
                } else {
                    doSwap();
                }
            } catch(e) { console.warn('Failed to apply video:', e); }
        }

        // ============================================================
        // === EDIT MODE: GIZMO drag for hotspot positioning ===
        // ============================================================
        var editOutput = document.getElementById('edit-output');
        var selectedHotspot = null;
        var editX = document.getElementById('edit-x');
        var editY = document.getElementById('edit-y');
        var editZ = document.getElementById('edit-z');

        // Gizmo elements
        var gizmoSvg = document.getElementById('gizmoSvg');
        var gizmoCenter = viewer.querySelector('[slot="hotspot-gizmo-center"]');
        var gizmoX = viewer.querySelector('[slot="hotspot-gizmo-x"]');
        var gizmoY = viewer.querySelector('[slot="hotspot-gizmo-y"]');
        var gizmoZ = viewer.querySelector('[slot="hotspot-gizmo-z"]');
        var gizmoLineX = document.getElementById('gizmo-line-x');
        var gizmoLineY = document.getElementById('gizmo-line-y');
        var gizmoLineZ = document.getElementById('gizmo-line-z');
        var GIZMO_OFFSET = 0.6; // distance of axis handles from center

        var draggingAxis = null; // 'x', 'y', or 'z'
        var dragStartMouse = null;
        var dragStartPos = null;

        function showGizmo(pos) {
            var p = pos.split(' ').map(Number);
            var cx = p[0], cy = p[1], cz = p[2];
            // Position gizmo hotspots around the selected hotspot
            viewer.updateHotspot({ name: 'hotspot-gizmo-center', position: cx + ' ' + cy + ' ' + cz });
            viewer.updateHotspot({ name: 'hotspot-gizmo-x', position: (cx + GIZMO_OFFSET) + ' ' + cy + ' ' + cz });
            viewer.updateHotspot({ name: 'hotspot-gizmo-y', position: cx + ' ' + (cy + GIZMO_OFFSET) + ' ' + cz });
            viewer.updateHotspot({ name: 'hotspot-gizmo-z', position: cx + ' ' + cy + ' ' + (cz + GIZMO_OFFSET) });
            gizmoCenter.style.display = '';
            gizmoX.style.display = '';
            gizmoY.style.display = '';
            gizmoZ.style.display = '';
            gizmoSvg.style.display = '';
            renderGizmoLines();
        }

        function hideGizmo() {
            if (gizmoCenter) gizmoCenter.style.display = 'none';
            if (gizmoX) gizmoX.style.display = 'none';
            if (gizmoY) gizmoY.style.display = 'none';
            if (gizmoZ) gizmoZ.style.display = 'none';
            if (gizmoSvg) gizmoSvg.style.display = 'none';
        }

        function renderGizmoLines() {
            if (!selectedHotspot || !editMode) return;
            var c = viewer.queryHotspot('hotspot-gizmo-center');
            var hx = viewer.queryHotspot('hotspot-gizmo-x');
            var hy = viewer.queryHotspot('hotspot-gizmo-y');
            var hz = viewer.queryHotspot('hotspot-gizmo-z');
            if (c && hx) {
                gizmoLineX.setAttribute('x1', c.canvasPosition.x);
                gizmoLineX.setAttribute('y1', c.canvasPosition.y);
                gizmoLineX.setAttribute('x2', hx.canvasPosition.x);
                gizmoLineX.setAttribute('y2', hx.canvasPosition.y);
            }
            if (c && hy) {
                gizmoLineY.setAttribute('x1', c.canvasPosition.x);
                gizmoLineY.setAttribute('y1', c.canvasPosition.y);
                gizmoLineY.setAttribute('x2', hy.canvasPosition.x);
                gizmoLineY.setAttribute('y2', hy.canvasPosition.y);
            }
            if (c && hz) {
                gizmoLineZ.setAttribute('x1', c.canvasPosition.x);
                gizmoLineZ.setAttribute('y1', c.canvasPosition.y);
                gizmoLineZ.setAttribute('x2', hz.canvasPosition.x);
                gizmoLineZ.setAttribute('y2', hz.canvasPosition.y);
            }
        }

        // Redraw gizmo lines on camera change
        viewer.addEventListener('camera-change', function() {
            if (editMode && selectedHotspot) renderGizmoLines();
        });

        // Select hotspot in edit mode
        viewer.querySelectorAll('.hotspot').forEach(function(hs, idx) {
            hs.addEventListener('click', function(e) {
                if (!editMode) return;
                e.stopPropagation();
                selectedHotspot = hs;
                document.getElementById('edit-selected').textContent = 'Точка ' + (idx + 1) + ': ' + hs.querySelector('.hotspot-annotation strong').textContent;
                var pos = hs.dataset.position.split(' ').map(Number);
                editX.value = pos[0].toFixed(2);
                editY.value = pos[1].toFixed(2);
                editZ.value = pos[2].toFixed(2);
                viewer.querySelectorAll('.hotspot').forEach(function(h) { h.style.outline = '2px solid yellow'; });
                hs.style.outline = '3px solid #00ff00';
                showGizmo(hs.dataset.position);
            });
        });

        // Number inputs still work as fallback
        function updateHotspotFromInputs() {
            if (!selectedHotspot) return;
            var x = parseFloat(editX.value) || 0;
            var y = parseFloat(editY.value) || 0;
            var z = parseFloat(editZ.value) || 0;
            var newPos = x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + z.toFixed(2);
            selectedHotspot.dataset.position = newPos;
            viewer.updateHotspot({ name: selectedHotspot.getAttribute('slot'), position: newPos });
            showGizmo(newPos);
        }
        editX.oninput = updateHotspotFromInputs;
        editY.oninput = updateHotspotFromInputs;
        editZ.oninput = updateHotspotFromInputs;

        // === GIZMO DRAG ===
        // Get screen direction for an axis by comparing center and axis handle screen positions
        function getAxisScreenDir(axis) {
            var c = viewer.queryHotspot('hotspot-gizmo-center');
            var h = viewer.queryHotspot('hotspot-gizmo-' + axis);
            if (!c || !h) return { x: 1, y: 0 };
            var dx = h.canvasPosition.x - c.canvasPosition.x;
            var dy = h.canvasPosition.y - c.canvasPosition.y;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return { x: 1, y: 0 };
            return { x: dx / len, y: dy / len };
        }

        function startDrag(axis, e) {
            if (!selectedHotspot) return;
            e.preventDefault();
            e.stopPropagation();
            draggingAxis = axis;
            dragStartMouse = { x: e.clientX, y: e.clientY };
            dragStartPos = selectedHotspot.dataset.position.split(' ').map(Number);
            // Disable camera controls while dragging
            viewer.removeAttribute('camera-controls');
            document.body.style.cursor = 'grabbing';
        }

        gizmoX.addEventListener('pointerdown', function(e) { startDrag('x', e); });
        gizmoY.addEventListener('pointerdown', function(e) { startDrag('y', e); });
        gizmoZ.addEventListener('pointerdown', function(e) { startDrag('z', e); });

        document.addEventListener('pointermove', function(e) {
            if (!draggingAxis || !selectedHotspot) return;
            e.preventDefault();
            var dx = e.clientX - dragStartMouse.x;
            var dy = e.clientY - dragStartMouse.y;
            // Project mouse delta onto axis screen direction
            var dir = getAxisScreenDir(draggingAxis);
            var projected = dx * dir.x + dy * dir.y;
            // Scale: pixels to world units (approximate)
            var sensitivity = 0.005;
            var delta = projected * sensitivity;
            var pos = dragStartPos.slice();
            if (draggingAxis === 'x') pos[0] += delta;
            if (draggingAxis === 'y') pos[1] += delta;
            if (draggingAxis === 'z') pos[2] += delta;
            var newPos = pos[0].toFixed(2) + ' ' + pos[1].toFixed(2) + ' ' + pos[2].toFixed(2);
            selectedHotspot.dataset.position = newPos;
            viewer.updateHotspot({ name: selectedHotspot.getAttribute('slot'), position: newPos });
            // Update inputs
            editX.value = pos[0].toFixed(2);
            editY.value = pos[1].toFixed(2);
            editZ.value = pos[2].toFixed(2);
            // Update gizmo position
            showGizmo(newPos);
        });

        document.addEventListener('pointerup', function() {
            if (draggingAxis) {
                draggingAxis = null;
                dragStartMouse = null;
                dragStartPos = null;
                // Re-enable camera controls
                viewer.setAttribute('camera-controls', '');
                document.body.style.cursor = '';
            }
        });

        // Save current camera for selected hotspot
        document.getElementById('edit-save-camera').onclick = function() {
            if (!selectedHotspot) { alert('Сначала выбери точку!'); return; }
            var orbit = viewer.getCameraOrbit();
            var target = viewer.getCameraTarget();
            var thetaDeg = (orbit.theta * 180 / Math.PI).toFixed(1);
            var phiDeg = (orbit.phi * 180 / Math.PI).toFixed(1);
            var orbitStr = thetaDeg + 'deg ' + phiDeg + 'deg ' + orbit.radius.toFixed(2) + 'm';
            var targetStr = target.x.toFixed(2) + 'm ' + target.y.toFixed(2) + 'm ' + target.z.toFixed(2) + 'm';
            selectedHotspot.dataset.orbit = orbitStr;
            selectedHotspot.dataset.target = targetStr;
            editOutput.textContent = 'Камера точки сохранена!\norbit: ' + orbitStr + '\ntarget: ' + targetStr;
        };

        // === START CAMERA: save current view as default ===
        var startOrbitLabel = document.getElementById('start-orbit-val');
        var startTargetLabel = document.getElementById('start-target-val');
        var startCameraLive = document.getElementById('start-camera-live');

        // Show live camera values when in editor tab
        viewer.addEventListener('camera-change', function() {
            if (!editMode) return;
            var orbit = viewer.getCameraOrbit();
            var target = viewer.getCameraTarget();
            if (startCameraLive) {
                var tDeg = (orbit.theta * 180 / Math.PI).toFixed(1);
                var pDeg = (orbit.phi * 180 / Math.PI).toFixed(1);
                startCameraLive.textContent = 'Сейчас: ' +
                    tDeg + 'deg ' + pDeg + 'deg ' + orbit.radius.toFixed(2) + 'm | ' +
                    target.x.toFixed(2) + ' ' + target.y.toFixed(2) + ' ' + target.z.toFixed(2);
            }
        });

        document.getElementById('edit-save-start-camera').onclick = function() {
            var orbit = viewer.getCameraOrbit();
            var target = viewer.getCameraTarget();
            var thetaDeg = (orbit.theta * 180 / Math.PI).toFixed(1);
            var phiDeg = (orbit.phi * 180 / Math.PI).toFixed(1);
            var orbitStr = thetaDeg + 'deg ' + phiDeg + 'deg ' + orbit.radius.toFixed(2) + 'm';
            var targetStr = target.x.toFixed(2) + 'm ' + target.y.toFixed(2) + 'm ' + target.z.toFixed(2) + 'm';
            defaultOrbit = orbitStr;
            defaultTarget = targetStr;
            startOrbitLabel.textContent = orbitStr;
            startTargetLabel.textContent = targetStr;
            editOutput.textContent = 'Стартовая камера сохранена!\norbit: ' + orbitStr + '\ntarget: ' + targetStr +
                '\n\nДля применения в HTML:\ncamera-orbit="' + orbitStr + '"\ncamera-target="' + targetStr + '"';
            navigator.clipboard.writeText('camera-orbit="' + orbitStr + '" camera-target="' + targetStr + '"').then(function() {
                console.log('Start camera copied to clipboard');
            });
        };

        // Export ALL hotspot data
        document.getElementById('edit-export').onclick = function() {
            var data = {
                model: viewer.src || '',
                environment: viewer.environmentImage || '',
                startCamera: {
                    orbit: defaultOrbit,
                    target: defaultTarget
                },
                hotspots: []
            };
            viewer.querySelectorAll('.hotspot').forEach(function(hs) {
                data.hotspots.push({
                    slot: hs.getAttribute('slot'),
                    position: hs.dataset.position,
                    normal: hs.dataset.normal,
                    orbit: hs.dataset.orbit || '',
                    target: hs.dataset.target || '',
                    label: hs.querySelector('.hotspot-annotation strong').textContent
                });
            });
            var json = JSON.stringify(data, null, 2);
            editOutput.textContent = json;
            navigator.clipboard.writeText(json).then(function() { console.log('Copied to clipboard!'); });
            var blob = new Blob([json], {type: 'application/json'});
            var a = document.createElement('a');
            a.download = 'hotspots-config.json';
            a.href = URL.createObjectURL(blob); a.click();
        };

        // === LOAD MODEL / ENVIRONMENT ===
        var modelStatus = document.getElementById('model-load-status');
        var modelFileInput = document.getElementById('model-file-input');
        var envFileInput = document.getElementById('env-file-input');

        document.getElementById('btn-load-model').onclick = function() { modelFileInput.click(); };
        modelFileInput.onchange = function() {
            var file = this.files[0];
            if (!file) return;
            modelStatus.textContent = 'Загрузка модели: ' + file.name + '...';
            modelStatus.style.color = '#d4c49a';
            var url = URL.createObjectURL(file);
            viewer.src = url;
            viewer.addEventListener('load', function onLoad() {
                viewer.removeEventListener('load', onLoad);
                modelStatus.textContent = 'Модель загружена: ' + file.name;
                modelStatus.style.color = '#28a745';
            });
            viewer.addEventListener('error', function onErr() {
                viewer.removeEventListener('error', onErr);
                modelStatus.textContent = 'Ошибка загрузки модели!';
                modelStatus.style.color = '#ff6b6b';
            });
        };

        document.getElementById('btn-load-model-url').onclick = function() {
            var url = document.getElementById('model-url-input').value.trim();
            if (!url) return;
            modelStatus.textContent = 'Загрузка модели по URL...';
            modelStatus.style.color = '#d4c49a';
            viewer.src = url;
            viewer.addEventListener('load', function onLoad() {
                viewer.removeEventListener('load', onLoad);
                modelStatus.textContent = 'Модель загружена!';
                modelStatus.style.color = '#28a745';
            });
            viewer.addEventListener('error', function onErr() {
                viewer.removeEventListener('error', onErr);
                modelStatus.textContent = 'Ошибка загрузки модели!';
                modelStatus.style.color = '#ff6b6b';
            });
        };

        document.getElementById('btn-load-env').onclick = function() { envFileInput.click(); };
        envFileInput.onchange = function() {
            var file = this.files[0];
            if (!file) return;
            modelStatus.textContent = 'Загрузка окружения: ' + file.name + '...';
            modelStatus.style.color = '#d4c49a';
            var url = URL.createObjectURL(file);
            viewer.environmentImage = url;
            modelStatus.textContent = 'Окружение применено: ' + file.name;
            modelStatus.style.color = '#28a745';
        };

        document.getElementById('btn-load-env-url').onclick = function() {
            var url = document.getElementById('env-url-input').value.trim();
            if (!url) return;
            viewer.environmentImage = url;
            modelStatus.textContent = 'Окружение загружено по URL!';
            modelStatus.style.color = '#28a745';
        };

        // === Model load ===
        viewer.addEventListener('load', function() {
            if (!viewer.model) return;
            allMaterials = viewer.model.materials;

            console.log('=== MODEL MATERIALS (' + allMaterials.length + ') ===');
            allMaterials.forEach(function(mat, i) {
                var ef = mat.emissiveFactor;
                console.log(i + ': "' + mat.name + '" emissive=[' + (ef ? ef.join(',') : 'none') + ']');
            });

            // Find screen material
            allMaterials.forEach(function(mat) {
                var name = (mat.name || '').toLowerCase();
                if (name.includes('video') || name.includes('screen') || name.includes('display') || name.includes('monitor')) {
                    screenMaterial = mat;
                    console.log('>>> Screen material: "' + mat.name + '"');
                }
            });

            // Find neon materials
            neonMaterials = [];
            allMaterials.forEach(function(mat) {
                var name = (mat.name || '').toLowerCase();
                var ef = mat.emissiveFactor;
                var hasEmissiveName = name.includes('line') || name.includes('neon') || name.includes('emissive') || name.includes('glow') || name.includes('led');
                var hasEmissiveValue = ef && (ef[0] > 0 || ef[1] > 0 || ef[2] > 0);
                if (hasEmissiveName || hasEmissiveValue) {
                    neonMaterials.push(mat);
                    console.log('>>> Neon material: "' + mat.name + '" emissive=[' + (ef ? ef.join(',') : '?') + ']');
                }
            });
            console.log('Total neon materials: ' + neonMaterials.length);

            // Apply default neon
            if (neonMaterials.length > 0) {
                var defHex = document.getElementById('neon-color').value;
                var r = parseInt(defHex.substr(1,2),16)/255;
                var g = parseInt(defHex.substr(3,2),16)/255;
                var b = parseInt(defHex.substr(5,2),16)/255;
                neonMaterials.forEach(function(mat) {
                    try { mat.setEmissiveFactor([r, g, b]); } catch(e) {}
                    try { mat.setEmissiveStrength(20.5); } catch(e) {}
                });
            }

            // Apply default metalness/roughness
            // Skip VideoScreenMaterial and the human character (Material.002 = rp_petra)
            allMaterials.forEach(function(mat) {
                var n = (mat.name || '').toLowerCase();
                if (!n.includes('video') && !n.includes('screen') && n !== 'material.002') {
                    try { mat.pbrMetallicRoughness.setMetallicFactor(0); } catch(e) {}
                    try { mat.pbrMetallicRoughness.setRoughnessFactor(0); } catch(e) {}
                }
            });

            // Apply default video (others will be cached on first switch)
            if (screenMaterial) {
                applyVideoTexture(document.getElementById('video-select').value);
            }

            // Apply default skybox blur
            try {
                var symbols = Object.getOwnPropertySymbols(viewer);
                var sceneSymbol = symbols.find(function(s) { return s.description === 'scene'; });
                if (sceneSymbol) {
                    viewer[sceneSymbol].backgroundBlurriness = 0.2;
                }
            } catch(e) {}

            // Fix z-fighting: continuously enforce minimum camera near clip
            // model-viewer recalculates near = far/1000 each frame via SmoothControls.updateNearFar
            // We override it every frame using rAF loop to ensure it sticks
            var threeCamera = null;
            var threeScene = null;
            try {
                var symbols = Object.getOwnPropertySymbols(viewer);
                var sceneSymbol = symbols.find(function(s) { return s.description === 'scene'; });
                if (sceneSymbol) {
                    threeScene = viewer[sceneSymbol];
                    threeCamera = threeScene.getCamera();
                    console.log('Three.js camera found, near=' + threeCamera.near + ' far=' + threeCamera.far);
                }
            } catch(e) { console.warn('Could not access Three.js camera:', e); }

            if (threeCamera) {
                // Aggressively clamp near plane to prevent z-fighting on screen
                function enforceNearClip() {
                    var minNear = threeCamera.far / 100;
                    if (minNear < 0.1) minNear = 0.1;
                    if (threeCamera.near < minNear) {
                        threeCamera.near = minNear;
                        threeCamera.updateProjectionMatrix();
                    }
                    requestAnimationFrame(enforceNearClip);
                }
                enforceNearClip();

                // Also apply logarithmic depth buffer workaround:
                // offset screen material slightly to avoid z-fighting
                try {
                    threeScene.traverse(function(obj) {
                        if (obj.material) {
                            var n = (obj.material.name || '').toLowerCase();
                            if (n.includes('video') || n.includes('screen')) {
                                obj.material.polygonOffset = true;
                                obj.material.polygonOffsetFactor = -1;
                                obj.material.polygonOffsetUnits = -1;
                                obj.material.depthWrite = true;
                                obj.material.needsUpdate = true;
                                console.log('Applied polygonOffset to:', obj.material.name);
                            }
                        }
                    });
                } catch(e) { console.warn('polygonOffset failed:', e); }
            }

            // Dimension labels
            var yLabel = viewer.querySelector('button[slot="hotspot-dim-y-label"]');
            if (yLabel) yLabel.textContent = '450 cm';
            var xLabel = viewer.querySelector('button[slot="hotspot-dim-x-label"]');
            if (xLabel) xLabel.textContent = '700 cm';
            renderDimLines();
        });

        // ============================================================
        // === CAMERA TARGET GIZMO ===
        // ============================================================
        var camTargetDot = viewer.querySelector('[slot="hotspot-cam-target"]');
        var camTargetGX = viewer.querySelector('[slot="hotspot-cam-target-x"]');
        var camTargetGY = viewer.querySelector('[slot="hotspot-cam-target-y"]');
        var camTargetGZ = viewer.querySelector('[slot="hotspot-cam-target-z"]');
        var camTargetSvg = document.getElementById('camTargetGizmoSvg');
        var camTargetLineX = document.getElementById('cam-target-line-x');
        var camTargetLineY = document.getElementById('cam-target-line-y');
        var camTargetLineZ = document.getElementById('cam-target-line-z');
        var camTargetToggle = document.getElementById('toggle-cam-target');
        var camTargetInputX = document.getElementById('cam-target-x');
        var camTargetInputY = document.getElementById('cam-target-y');
        var camTargetInputZ = document.getElementById('cam-target-z');
        var camTargetStatus = document.getElementById('cam-target-status');
        var CAM_TARGET_GIZMO_OFFSET = 0.4;
        var camTargetVisible = false;
        var camTargetDragging = null; // 'x','y','z' or null
        var camTargetDragStart = null;
        var camTargetDragPos = null;

        function getCamTargetPos() {
            var t = viewer.getCameraTarget();
            return [t.x, t.y, t.z];
        }

        function setCamTargetPos(pos) {
            var str = pos[0].toFixed(3) + 'm ' + pos[1].toFixed(3) + 'm ' + pos[2].toFixed(3) + 'm';
            viewer.cameraTarget = str;
            defaultTarget = str;
            camTargetInputX.value = pos[0].toFixed(3);
            camTargetInputY.value = pos[1].toFixed(3);
            camTargetInputZ.value = pos[2].toFixed(3);
            updateCamTargetGizmo(pos);
        }

        function updateCamTargetGizmo(pos) {
            if (!pos) pos = getCamTargetPos();
            var cx = pos[0], cy = pos[1], cz = pos[2];
            viewer.updateHotspot({ name: 'hotspot-cam-target', position: cx + ' ' + cy + ' ' + cz });
            viewer.updateHotspot({ name: 'hotspot-cam-target-x', position: (cx + CAM_TARGET_GIZMO_OFFSET) + ' ' + cy + ' ' + cz });
            viewer.updateHotspot({ name: 'hotspot-cam-target-y', position: cx + ' ' + (cy + CAM_TARGET_GIZMO_OFFSET) + ' ' + cz });
            viewer.updateHotspot({ name: 'hotspot-cam-target-z', position: cx + ' ' + cy + ' ' + (cz + CAM_TARGET_GIZMO_OFFSET) });
        }

        function renderCamTargetLines() {
            if (!camTargetVisible) return;
            var c = viewer.queryHotspot('hotspot-cam-target');
            var hx = viewer.queryHotspot('hotspot-cam-target-x');
            var hy = viewer.queryHotspot('hotspot-cam-target-y');
            var hz = viewer.queryHotspot('hotspot-cam-target-z');
            if (c && hx) {
                camTargetLineX.setAttribute('x1', c.canvasPosition.x);
                camTargetLineX.setAttribute('y1', c.canvasPosition.y);
                camTargetLineX.setAttribute('x2', hx.canvasPosition.x);
                camTargetLineX.setAttribute('y2', hx.canvasPosition.y);
            }
            if (c && hy) {
                camTargetLineY.setAttribute('x1', c.canvasPosition.x);
                camTargetLineY.setAttribute('y1', c.canvasPosition.y);
                camTargetLineY.setAttribute('x2', hy.canvasPosition.x);
                camTargetLineY.setAttribute('y2', hy.canvasPosition.y);
            }
            if (c && hz) {
                camTargetLineZ.setAttribute('x1', c.canvasPosition.x);
                camTargetLineZ.setAttribute('y1', c.canvasPosition.y);
                camTargetLineZ.setAttribute('x2', hz.canvasPosition.x);
                camTargetLineZ.setAttribute('y2', hz.canvasPosition.y);
            }
        }

        function showCamTargetGizmo() {
            camTargetVisible = true;
            var pos = getCamTargetPos();
            updateCamTargetGizmo(pos);
            camTargetInputX.value = pos[0].toFixed(3);
            camTargetInputY.value = pos[1].toFixed(3);
            camTargetInputZ.value = pos[2].toFixed(3);
            camTargetDot.style.display = '';
            camTargetGX.style.display = '';
            camTargetGY.style.display = '';
            camTargetGZ.style.display = '';
            camTargetSvg.style.display = '';
            renderCamTargetLines();
        }

        function hideCamTargetGizmo() {
            camTargetVisible = false;
            camTargetDot.style.display = 'none';
            camTargetGX.style.display = 'none';
            camTargetGY.style.display = 'none';
            camTargetGZ.style.display = 'none';
            camTargetSvg.style.display = 'none';
        }

        camTargetToggle.onchange = function() {
            if (this.checked) showCamTargetGizmo();
            else hideCamTargetGizmo();
        };

        // Redraw on camera change
        viewer.addEventListener('camera-change', function() {
            if (camTargetVisible && !camTargetDragging) {
                updateCamTargetGizmo();
                renderCamTargetLines();
            } else if (camTargetVisible) {
                renderCamTargetLines();
            }
        });

        // Gizmo drag for camera target
        function getCamTargetAxisScreenDir(axis) {
            var c = viewer.queryHotspot('hotspot-cam-target');
            var h = viewer.queryHotspot('hotspot-cam-target-' + axis);
            if (!c || !h) return { x: 1, y: 0 };
            var dx = h.canvasPosition.x - c.canvasPosition.x;
            var dy = h.canvasPosition.y - c.canvasPosition.y;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return { x: 1, y: 0 };
            return { x: dx / len, y: dy / len };
        }

        function startCamTargetDrag(axis, e) {
            e.preventDefault();
            e.stopPropagation();
            camTargetDragging = axis;
            camTargetDragStart = { x: e.clientX, y: e.clientY };
            camTargetDragPos = getCamTargetPos();
            viewer.removeAttribute('camera-controls');
            document.body.style.cursor = 'grabbing';
        }

        camTargetGX.addEventListener('pointerdown', function(e) { startCamTargetDrag('x', e); });
        camTargetGY.addEventListener('pointerdown', function(e) { startCamTargetDrag('y', e); });
        camTargetGZ.addEventListener('pointerdown', function(e) { startCamTargetDrag('z', e); });

        document.addEventListener('pointermove', function(e) {
            if (!camTargetDragging) return;
            e.preventDefault();
            var dx = e.clientX - camTargetDragStart.x;
            var dy = e.clientY - camTargetDragStart.y;
            var dir = getCamTargetAxisScreenDir(camTargetDragging);
            var projected = dx * dir.x + dy * dir.y;
            var sensitivity = 0.005;
            var delta = projected * sensitivity;
            var pos = camTargetDragPos.slice();
            if (camTargetDragging === 'x') pos[0] += delta;
            if (camTargetDragging === 'y') pos[1] += delta;
            if (camTargetDragging === 'z') pos[2] += delta;
            setCamTargetPos(pos);
        });

        document.addEventListener('pointerup', function() {
            if (camTargetDragging) {
                camTargetDragging = null;
                camTargetDragStart = null;
                camTargetDragPos = null;
                viewer.setAttribute('camera-controls', '');
                document.body.style.cursor = '';
            }
        });

        // Number inputs for camera target
        function applyCamTargetFromInputs() {
            var x = parseFloat(camTargetInputX.value) || 0;
            var y = parseFloat(camTargetInputY.value) || 0;
            var z = parseFloat(camTargetInputZ.value) || 0;
            setCamTargetPos([x, y, z]);
        }
        camTargetInputX.oninput = applyCamTargetFromInputs;
        camTargetInputY.oninput = applyCamTargetFromInputs;
        camTargetInputZ.oninput = applyCamTargetFromInputs;

        // Apply button
        document.getElementById('btn-save-cam-target').onclick = function() {
            applyCamTargetFromInputs();
            camTargetStatus.textContent = 'Таргет применён: ' + defaultTarget;
            camTargetStatus.style.color = '#e67e22';
        };

        // Persist button — saves to HTML attribute + copies to clipboard
        document.getElementById('btn-persist-cam-target').onclick = function() {
            applyCamTargetFromInputs();
            // Update the HTML attribute on the model-viewer element
            viewer.setAttribute('camera-target', defaultTarget);
            var code = 'camera-target="' + defaultTarget + '"';
            navigator.clipboard.writeText(code).then(function() {
                camTargetStatus.textContent = 'Сохранено! Скопировано: ' + code;
                camTargetStatus.style.color = '#28a745';
            }).catch(function() {
                camTargetStatus.textContent = 'Сохранено! ' + code;
                camTargetStatus.style.color = '#28a745';
            });
            // Also update the defaultTarget so idle reset uses new value
            console.log('Camera target persisted:', defaultTarget);
        };

        // Debug helper
        window.applyVideoToMaterial = function(idx, file) {
            var mat = allMaterials[idx]; if (!mat) return;
            if (!videoTextureCache[file]) {
                videoTextureCache[file] = viewer.createVideoTexture(file);
            }
            var tex = videoTextureCache[file];
            mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
            mat.pbrMetallicRoughness.setMetallicFactor(0);
            mat.pbrMetallicRoughness.setRoughnessFactor(1);
            console.log('Applied ' + file + ' to "' + mat.name + '"');
        };
        console.log('All controls initialized!');
    }

    if (viewer.updateHotspot) init();
    else customElements.whenDefined('model-viewer').then(init);
});
