(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Demonstration page — Earth + LEO/MEO/GEO orbital visualization.
    //
    // Self-contained sibling to the hero's three-scene.js: reuses the same
    // real-physics approach (Kepler's third law, one shared
    // SIMULATION_TIME_SCALE so relative LEO/MEO/GEO speeds stay physically
    // correct) but is a leaner, purpose-built scene for this smaller card
    // — no nebula/sun/HUD rings/mouse-parallax, and simpler labels (no
    // screen-space collision solver, just fixed well-separated preferred
    // angles, which is enough for a compact card with only 3 labels).
    // ------------------------------------------------------------------

    const MU_EARTH = 3.986004418e14; // m^3/s^2
    const EARTH_RADIUS_KM = 6371;
    const SIMULATION_TIME_SCALE = 320; // same value/reasoning as the hero scene

    const STATE = {
        scene: null,
        camera: null,
        renderer: null,
        earthGroup: null,
        earth: null,
        satellites: [],
        orbitLabels: [],
        orbitLabelOverlay: null,
        isPaused: false,
        reducedMotion: false,
        lastFrameTimeMs: undefined,
        cameraRotation: { theta: 0.6, phi: 1.15, radius: 9 },
        cameraPresetIndex: 0,
        isDragging: false,
        previousMouse: { x: 0, y: 0 },
        animationFrameId: null
    };

    const CAMERA_PRESETS = [
        { theta: 0.6, phi: 1.15, radius: 9 },
        { theta: 2.3, phi: 1.0, radius: 9 },
        { theta: -1.1, phi: 1.35, radius: 9.5 }
    ];

    window.addEventListener('DOMContentLoaded', init);

    function init() {
        const container = document.getElementById('demo-orbit-canvas');
        if (!container) {
            console.error('[demo-orbit-scene] #demo-orbit-canvas not found in the DOM — check demonstration.html for that element, or that this script is running on the right page.');
            return;
        }

        if (typeof THREE === 'undefined') {
            console.error('[demo-orbit-scene] THREE is not defined — the three.js <script> tag (CDN) either failed to load or is missing/out of order in demonstration.html. Check the Network tab for a failed/blocked request to cdnjs.cloudflare.com, and confirm the three.min.js <script> tag appears BEFORE demo-orbit-scene.js.');
            return;
        }

        try {
            STATE.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            const width = container.clientWidth;
            const height = container.clientHeight || 420;

            STATE.scene = new THREE.Scene();
            STATE.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
            updateCameraFromRotation();

            STATE.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            STATE.renderer.setSize(width, height);
            STATE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            STATE.renderer.toneMappingExposure = 1.0;
            container.appendChild(STATE.renderer.domElement);

            STATE.scene.add(new THREE.AmbientLight(0x30456b, 1.6));
            const key = new THREE.DirectionalLight(0xffffff, 2.4);
            key.position.set(6, 4, 8);
            STATE.scene.add(key);

            buildStars();
            buildEarth();
            buildOrbitsAndSatellites();
            setupInteraction(container);

            window.addEventListener('resize', () => onResize(container));

            animate();
        } catch (err) {
            console.error('[demo-orbit-scene] Failed during 3D scene setup — the canvas will stay blank. Error was:', err);
        }

        // Wired independently of the try block above (own try/catch) so
        // Pause/Reset/Camera/Details can still respond even if the WebGL
        // scene itself failed to build for some reason — previously both
        // failed together silently since wireControls() only ran after
        // every scene-setup step succeeded.
        try {
            wireControls();
        } catch (err) {
            console.error('[demo-orbit-scene] Failed to wire up control buttons:', err);
        }
    }

    function buildStars() {
        const count = 400;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 40 + Math.random() * 40;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0x9fc0ff, size: 0.09, transparent: true, opacity: 0.6 });
        STATE.scene.add(new THREE.Points(geo, mat));
    }

    function buildEarth() {
        STATE.earthGroup = new THREE.Group();
        STATE.scene.add(STATE.earthGroup);

        const sphereRadius = 1.6;
        STATE.sphereRadius = sphereRadius;

        const loader = new THREE.TextureLoader();
        const earthMat = new THREE.MeshStandardMaterial({ color: 0x2a4a6b, roughness: 0.8, metalness: 0.1 });
        loader.load('/assets/earth-texture.jpg', (tex) => { earthMat.map = tex; earthMat.needsUpdate = true; }, undefined, () => {});

        STATE.earth = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, 48, 48), earthMat);
        STATE.earthGroup.add(STATE.earth);

        // Soft atmosphere rim
        const atmosphereMat = new THREE.ShaderMaterial({
            vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `varying vec3 vN; void main(){ float i=pow(0.7-dot(vN,vec3(0,0,1.0)),3.0); gl_FragColor=vec4(0.35,0.6,1.0,1.0)*i; }`,
            blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true
        });
        STATE.earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(sphereRadius + 0.12, 48, 48), atmosphereMat));
    }

    function computeOrbitPhysics(altitudeKm, sphereRadius) {
        const rKm = EARTH_RADIUS_KM + altitudeKm;
        const rMeters = rKm * 1000;
        const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(rMeters, 3) / MU_EARTH);
        const angularVelocityRealRadPerSec = (2 * Math.PI) / periodSeconds;
        const sceneRadius = (rKm / EARTH_RADIUS_KM) * sphereRadius;
        return { rKm, periodSeconds, angularVelocityRealRadPerSec, sceneRadius };
    }

    function buildOrbitsAndSatellites() {
        const sphereRadius = STATE.sphereRadius;

        const ORBIT_CLASSES = [
            { key: 'LEO', altitudeKm: 1000, color: 0x4f7fd6, inclinationDeg: 18, raanDeg: 10, preferredAngleDeg: 55, satCount: 1 },
            { key: 'MEO', altitudeKm: 10000, color: 0x2ec4b6, inclinationDeg: 42, raanDeg: 95, preferredAngleDeg: 165, satCount: 1 },
            { key: 'GEO', altitudeKm: 35786, color: 0x5eead4, inclinationDeg: 4, raanDeg: 190, preferredAngleDeg: 290, satCount: 1 }
        ];

        ORBIT_CLASSES.forEach((cls) => {
            const physics = computeOrbitPhysics(cls.altitudeKm, sphereRadius);

            const planeGroup = new THREE.Group();
            planeGroup.rotation.x = THREE.MathUtils.degToRad(cls.inclinationDeg);
            planeGroup.rotation.y = THREE.MathUtils.degToRad(cls.raanDeg);
            STATE.earthGroup.add(planeGroup);

            const points = [];
            for (let i = 0; i <= 128; i++) {
                const theta = (i / 128) * Math.PI * 2;
                points.push(new THREE.Vector3(Math.cos(theta) * physics.sceneRadius, 0, Math.sin(theta) * physics.sceneRadius));
            }
            const ringMat = new THREE.LineDashedMaterial({
                color: cls.color, transparent: true, opacity: 0.35, dashSize: 0.12, gapSize: 0.08
            });
            const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMat);
            ring.computeLineDistances();
            planeGroup.add(ring);

            for (let s = 0; s < cls.satCount; s++) {
                const satGroup = new THREE.Group();
                const bus = new THREE.Mesh(
                    new THREE.BoxGeometry(0.09, 0.09, 0.13),
                    new THREE.MeshPhongMaterial({ color: 0xdddddd, emissive: 0x0f2447, shininess: 50 })
                );
                satGroup.add(bus);
                const panelGeo = new THREE.BoxGeometry(0.26, 0.01, 0.08);
                const panelMat = new THREE.MeshPhongMaterial({ color: 0x60a5fa, emissive: 0x07111e, shininess: 80 });
                const p1 = new THREE.Mesh(panelGeo, panelMat); p1.position.x = 0.17; satGroup.add(p1);
                const p2 = p1.clone(); p2.position.x = -0.17; satGroup.add(p2);

                planeGroup.add(satGroup);

                STATE.satellites.push({
                    group: satGroup,
                    orbitRadius: physics.sceneRadius,
                    angularVelocityReal: physics.angularVelocityRealRadPerSec,
                    angle: Math.random() * Math.PI * 2
                });
            }

            buildLabel(cls, physics, planeGroup);
        });
    }

    function ensureLabelOverlay() {
        if (STATE.orbitLabelOverlay) return STATE.orbitLabelOverlay;
        const container = document.getElementById('demo-orbit-canvas');
        if (!container) return null;
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2;';
        container.appendChild(overlay);
        STATE.orbitLabelOverlay = overlay;
        return overlay;
    }

    function buildLabel(cls, physics, planeGroup) {
        const overlay = ensureLabelOverlay();
        if (!overlay) return;
        const hex = `#${cls.color.toString(16).padStart(6, '0')}`;
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:0;top:0;opacity:0;transform:translate(-50%,-50%);
            font-family:monospace;white-space:nowrap;text-align:center;transition:opacity .15s ease-out;`;
        el.innerHTML = `<div style="font-size:12px;font-weight:bold;color:${hex};">${cls.key}</div>
            <div style="font-size:9px;color:rgba(200,220,240,0.75);">~${cls.altitudeKm.toLocaleString()} km</div>`;
        overlay.appendChild(el);
        STATE.orbitLabels.push({ el, planeGroup, sceneRadius: physics.sceneRadius, preferredAngleDeg: cls.preferredAngleDeg });
    }

    function updateLabels() {
        if (!STATE.orbitLabels.length) return;
        const size = STATE.renderer.getSize(new THREE.Vector2());
        const worldPos = new THREE.Vector3();

        let earthNdcCenter = null, earthNdcRadius = 0;
        if (STATE.earthGroup) {
            const c = new THREE.Vector3();
            STATE.earthGroup.getWorldPosition(c);
            const cNdc = c.clone().project(STATE.camera);
            if (cNdc.z < 1) {
                const edge = new THREE.Vector3(STATE.sphereRadius, 0, 0);
                STATE.earthGroup.localToWorld(edge);
                const eNdc = edge.clone().project(STATE.camera);
                earthNdcCenter = cNdc;
                earthNdcRadius = Math.hypot(eNdc.x - cNdc.x, eNdc.y - cNdc.y);
            }
        }

        function angleDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

        STATE.orbitLabels.forEach((lbl) => {
            let best = null, bestScore = Infinity;
            for (let i = 0; i < 48; i++) {
                const thetaDeg = (i / 48) * 360;
                const theta = THREE.MathUtils.degToRad(thetaDeg);
                worldPos.set(Math.cos(theta) * (lbl.sceneRadius + 0.18), 0, Math.sin(theta) * (lbl.sceneRadius + 0.18));
                lbl.planeGroup.localToWorld(worldPos);
                const ndc = worldPos.clone().project(STATE.camera);
                if (ndc.z >= 1) continue;
                const overEarth = earthNdcCenter && Math.hypot(ndc.x - earthNdcCenter.x, ndc.y - earthNdcCenter.y) < earthNdcRadius * 1.15;
                const score = angleDiff(thetaDeg, lbl.preferredAngleDeg) + (overEarth ? 500 : 0);
                if (score < bestScore) { bestScore = score; best = ndc; }
            }
            if (!best) { lbl.el.style.opacity = '0'; return; }
            const cx = Math.max(-0.92, Math.min(0.92, best.x));
            const cy = Math.max(-0.92, Math.min(0.92, best.y));
            lbl.el.style.opacity = '0.9';
            lbl.el.style.left = `${(cx * 0.5 + 0.5) * size.x}px`;
            lbl.el.style.top = `${(-cy * 0.5 + 0.5) * size.y}px`;
        });
    }

    function updateCameraFromRotation() {
        const r = STATE.cameraRotation;
        STATE.camera.position.x = r.radius * Math.sin(r.phi) * Math.sin(r.theta);
        STATE.camera.position.y = r.radius * Math.cos(r.phi);
        STATE.camera.position.z = r.radius * Math.sin(r.phi) * Math.cos(r.theta);
        STATE.camera.lookAt(0, 0, 0);
    }

    function setupInteraction(container) {
        container.addEventListener('mousedown', (e) => {
            STATE.isDragging = true;
            STATE.previousMouse = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('mouseup', () => { STATE.isDragging = false; });
        window.addEventListener('mousemove', (e) => {
            if (!STATE.isDragging) return;
            const dx = e.clientX - STATE.previousMouse.x;
            const dy = e.clientY - STATE.previousMouse.y;
            STATE.cameraRotation.theta -= dx * 0.006;
            STATE.cameraRotation.phi = Math.max(0.4, Math.min(2.4, STATE.cameraRotation.phi - dy * 0.006));
            STATE.previousMouse = { x: e.clientX, y: e.clientY };
            updateCameraFromRotation();
        });
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            STATE.cameraRotation.radius = Math.max(5, Math.min(16, STATE.cameraRotation.radius + e.deltaY * 0.01));
            updateCameraFromRotation();
        }, { passive: false });
    }

    function wireControls() {
        const pauseBtn = document.getElementById('demo-orbit-pause');
        const resetBtn = document.getElementById('demo-orbit-reset');
        const cameraBtn = document.getElementById('demo-orbit-camera');
        const detailsBtn = document.getElementById('demo-orbit-details');

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                STATE.isPaused = !STATE.isPaused;
                pauseBtn.setAttribute('aria-pressed', String(STATE.isPaused));
                var label = pauseBtn.querySelector('.demo-orbit-btn-label');
                if (label) label.textContent = STATE.isPaused ? 'Play' : 'Pause';
            });
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                STATE.cameraPresetIndex = 0;
                STATE.cameraRotation = Object.assign({}, CAMERA_PRESETS[0]);
                updateCameraFromRotation();
            });
        }
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => {
                STATE.cameraPresetIndex = (STATE.cameraPresetIndex + 1) % CAMERA_PRESETS.length;
                STATE.cameraRotation = Object.assign({}, CAMERA_PRESETS[STATE.cameraPresetIndex]);
                updateCameraFromRotation();
            });
        }
        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                const showing = STATE.orbitLabels.some(function (l) { return l.el.style.opacity !== '0'; });
                STATE.orbitLabels.forEach(function (l) { l.el.dataset.forceHide = showing ? '1' : ''; });
                detailsBtn.setAttribute('aria-pressed', String(!showing));
            });
        }
    }

    function onResize(container) {
        const width = container.clientWidth;
        const height = container.clientHeight || 420;
        STATE.camera.aspect = width / height;
        STATE.camera.updateProjectionMatrix();
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        STATE.renderer.setSize(width, height);
    }

    function animate() {
        STATE.animationFrameId = requestAnimationFrame(animate);

        const nowMs = performance.now();
        if (STATE.lastFrameTimeMs === undefined) STATE.lastFrameTimeMs = nowMs;
        const realDelta = Math.min((nowMs - STATE.lastFrameTimeMs) / 1000, 0.1);
        STATE.lastFrameTimeMs = nowMs;

        const motionSpeed = (STATE.reducedMotion || STATE.isPaused) ? 0 : 1;
        const simDelta = realDelta * SIMULATION_TIME_SCALE;

        if (STATE.earth) STATE.earth.rotation.y += 0.0006 * motionSpeed;

        STATE.satellites.forEach(function (sat) {
            sat.angle += sat.angularVelocityReal * simDelta * motionSpeed;
            sat.group.position.set(Math.cos(sat.angle) * sat.orbitRadius, 0, Math.sin(sat.angle) * sat.orbitRadius);
        });

        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
            updateLabels();
            STATE.orbitLabels.forEach(function (l) {
                if (l.el.dataset.forceHide === '1') l.el.style.opacity = '0';
            });
        }
    }
})();