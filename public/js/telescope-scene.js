(function () {
    'use strict';

    // State namespace for Telescope Scene
    const TELE_STATE = {
        scene: null,
        camera: null,
        renderer: null,
        telescopeBase: null,
        telescopeTube: null,
        beam: null,
        satellite: null,
        satelliteOrbitAngle: 0,
        orbitRadiusX: 5.0,
        orbitRadiusZ: 5.0,
        orbitPlaneRotationX: 0.3,
        orbitPlaneRotationZ: 0.2,
        starfield: null,
        constellations: null,
        isPaused: false,
        isTabActive: true,
        isViewportVisible: false,
        animationFrameId: null,
        reducedMotion: false,
        cameraRotation: { theta: 0.8, phi: 1.1, radius: 14 },
        previousMousePosition: { x: 0, y: 0 },
        isDragging: false
    };

    window.addEventListener('DOMContentLoaded', () => {
        initTelescopeVisualization();
    });

    function initTelescopeVisualization() {
        const container = document.getElementById('telescope-canvas');
        const containerWrapper = document.getElementById('telescope-canvas-container');
        const fallbackContainer = document.getElementById('telescope-fallback');

        if (!container || !containerWrapper) return;

        // 1. Reduced Motion Check
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        TELE_STATE.reducedMotion = motionQuery.matches;
        motionQuery.addEventListener('change', (e) => {
            TELE_STATE.reducedMotion = e.matches;
            handleMotionSettings(fallbackContainer, containerWrapper);
        });

        // 2. WebGL Support Check
        if (!isWebGLAvailable()) {
            showFallback(fallbackContainer, containerWrapper);
            return;
        }

        // Initialize scene
        handleMotionSettings(fallbackContainer, containerWrapper);
        if (TELE_STATE.reducedMotion) {
            // Render a single static frame or fallback
            buildScene(container);
            renderSingleFrame();
        } else {
            buildScene(container);
            setupInteraction(container);
            setupButtons();
            setupObservers(containerWrapper);
            toggleLoop();
        }
    }

    function isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    function showFallback(fallback, wrapper) {
        if (fallback) fallback.style.display = 'flex';
        if (wrapper) wrapper.style.display = 'none';
        
        // Hide control buttons
        const pauseBtn = document.getElementById('vis-pause-btn');
        const resetBtn = document.getElementById('vis-reset-btn');
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
    }

    function handleMotionSettings(fallback, wrapper) {
        if (TELE_STATE.reducedMotion) {
            showFallback(fallback, wrapper);
        } else {
            if (fallback) fallback.style.display = 'none';
            if (wrapper) wrapper.style.display = 'block';
        }
    }

    function buildScene(container) {
        const width = container.clientWidth;
        const height = container.clientHeight || 480;

        // Scene
        TELE_STATE.scene = new THREE.Scene();
        TELE_STATE.scene.fog = new THREE.FogExp2(0x050811, 0.015);

        // Camera
        TELE_STATE.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        updateCamera();

        // Renderer
        TELE_STATE.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        TELE_STATE.renderer.setSize(width, height);
        
        // Performance: limit pixel ratios
        const isMobile = window.innerWidth < 768;
        TELE_STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2.0));
        container.appendChild(TELE_STATE.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x0a1428, 1.8);
        TELE_STATE.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 10, 7);
        TELE_STATE.scene.add(dirLight);

        const blueHighlight = new THREE.DirectionalLight(0x4f7fd6, 1.2);
        blueHighlight.position.set(-5, 2, -5);
        TELE_STATE.scene.add(blueHighlight);

        // Geometries Builder
        buildStarfield();
        buildOrbitPath();
        buildSatellite();
        buildTelescope();

        // Resize Listener
        window.addEventListener('resize', onResize);
    }

    function buildStarfield() {
        const starCount = window.innerWidth < 768 ? 150 : 400;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            // Distribute on sphere
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const radius = 40 + Math.random() * 20;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // Subtle color tint
            const tint = Math.random();
            colors[i * 3] = 0.85 + tint * 0.15;
            colors[i * 3 + 1] = 0.9 + tint * 0.1;
            colors[i * 3 + 2] = 1.0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Procedural Star Texture
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(141, 177, 245, 0.8)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);
        const starTexture = new THREE.CanvasTexture(canvas);

        const material = new THREE.PointsMaterial({
            size: 0.45,
            vertexColors: true,
            map: starTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        TELE_STATE.starfield = new THREE.Points(geometry, material);
        TELE_STATE.scene.add(TELE_STATE.starfield);

        // Constellation Lines (subtle low-opacity linking lines)
        const lineGeo = new THREE.BufferGeometry();
        const linePos = [];
        // Connect random pairs of nearby stars to look like constellation lines
        const posArr = positions;
        const maxDistSq = 8.0 * 8.0;
        let connections = 0;
        for (let i = 0; i < starCount && connections < 25; i++) {
            const x1 = posArr[i * 3];
            const y1 = posArr[i * 3 + 1];
            const z1 = posArr[i * 3 + 2];
            for (let j = i + 1; j < starCount; j++) {
                const x2 = posArr[j * 3];
                const y2 = posArr[j * 3 + 1];
                const z2 = posArr[j * 3 + 2];
                const distSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1);
                if (distSq < maxDistSq) {
                    linePos.push(x1, y1, z1, x2, y2, z2);
                    connections++;
                    break;
                }
            }
        }
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x4f7fd6,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending
        });
        TELE_STATE.constellations = new THREE.LineSegments(lineGeo, lineMat);
        TELE_STATE.scene.add(TELE_STATE.constellations);
    }

    function buildOrbitPath() {
        const points = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta) * TELE_STATE.orbitRadiusX;
            const z = Math.sin(theta) * TELE_STATE.orbitRadiusZ;
            
            // Build 3D point and rotate it matching the satellite plane
            const p = new THREE.Vector3(x, 0, z);
            p.applyAxisAngle(new THREE.Vector3(1, 0, 0), TELE_STATE.orbitPlaneRotationX);
            p.applyAxisAngle(new THREE.Vector3(0, 0, 1), TELE_STATE.orbitPlaneRotationZ);
            // Height offset
            p.y += 2.0; 
            points.push(p);
        }

        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0x4f7fd6,
            transparent: true,
            opacity: 0.18
        });
        const orbitPath = new THREE.Line(geom, mat);
        TELE_STATE.scene.add(orbitPath);
    }

    function buildSatellite() {
        TELE_STATE.satellite = new THREE.Group();

        // Main Satellite Body
        const bodyGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x8db1f5, specular: 0xffffff, shininess: 30 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        TELE_STATE.satellite.add(body);

        // Solar panels
        const panelGeo = new THREE.BoxGeometry(0.5, 0.02, 0.12);
        const panelMat = new THREE.MeshPhongMaterial({ color: 0x112140, emissive: 0x050c1e });
        
        const leftPanel = new THREE.Mesh(panelGeo, panelMat);
        leftPanel.position.x = 0.35;
        TELE_STATE.satellite.add(leftPanel);

        const rightPanel = leftPanel.clone();
        rightPanel.position.x = -0.35;
        TELE_STATE.satellite.add(rightPanel);

        // Target Reticle around Satellite (Dotted circle billboarded or flat)
        const reticleGeo = new THREE.RingGeometry(0.4, 0.44, 16);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0x2ec4b6,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const reticle = new THREE.Mesh(reticleGeo, reticleMat);
        reticle.rotation.x = Math.PI / 2; // Flat on the object
        TELE_STATE.satellite.add(reticle);

        TELE_STATE.scene.add(TELE_STATE.satellite);
    }

    function buildTelescope() {
        // Base structure group
        TELE_STATE.telescopeBase = new THREE.Group();
        TELE_STATE.telescopeBase.position.y = 0;

        // Platform circular base ring
        const platGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
        const platMat = new THREE.MeshStandardMaterial({ color: 0x0b1326, roughness: 0.7 });
        const platform = new THREE.Mesh(platGeo, platMat);
        platform.position.y = 0.1;
        TELE_STATE.telescopeBase.add(platform);

        // Sub base cylinder (concrete block)
        const blockGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.6, 20);
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x080f1e, roughness: 0.8 });
        const concreteBase = new THREE.Mesh(blockGeo, blockMat);
        concreteBase.position.y = 0.4;
        TELE_STATE.telescopeBase.add(concreteBase);

        // Forks / Mount Columns
        const forkGroup = new THREE.Group();
        forkGroup.position.y = 0.7; // Mount base height

        const forkColGeo = new THREE.BoxGeometry(0.2, 0.9, 0.4);
        const forkMat = new THREE.MeshStandardMaterial({ color: 0x0b1326, metalness: 0.3, roughness: 0.5 });
        
        const leftFork = new THREE.Mesh(forkColGeo, forkMat);
        leftFork.position.x = 0.55;
        leftFork.position.y = 0.45;
        forkGroup.add(leftFork);

        const rightFork = leftFork.clone();
        rightFork.position.x = -0.55;
        forkGroup.add(rightFork);

        // Axle connector
        const axleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 16);
        axleGeo.rotateZ(Math.PI / 2);
        const axleMat = new THREE.MeshStandardMaterial({ color: 0x4f7fd6, metalness: 0.8, roughness: 0.2 });
        const axle = new THREE.Mesh(axleGeo, axleMat);
        axle.position.y = 0.65;
        forkGroup.add(axle);

        TELE_STATE.telescopeBase.add(forkGroup);
        TELE_STATE.scene.add(TELE_STATE.telescopeBase);

        // TUBE / OTA Group (Pivoted for elevation rotation)
        TELE_STATE.telescopeTube = new THREE.Group();
        TELE_STATE.telescopeTube.position.set(0, 0.65 + 0.7, 0); // Align with axle center

        // Optical Tube body
        const tubeBodyGeo = new THREE.CylinderGeometry(0.36, 0.42, 1.6, 20);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0x070c18, roughness: 0.6, metalness: 0.1 });
        const tubeBody = new THREE.Mesh(tubeBodyGeo, tubeMat);
        tubeBody.rotation.x = Math.PI / 2; // Point along Z axis
        TELE_STATE.telescopeTube.add(tubeBody);

        // Tube shiny top bezel rim
        const bezelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 20);
        const bezelMat = new THREE.MeshStandardMaterial({ color: 0x8db1f5, metalness: 0.8, roughness: 0.1 });
        const bezel = new THREE.Mesh(bezelGeo, bezelMat);
        bezel.position.z = 0.8; // aperture end of tube
        bezel.rotation.x = Math.PI / 2;
        TELE_STATE.telescopeTube.add(bezel);

        // Inner mirror/sensor (dark blue disk inside)
        const mirrorGeo = new THREE.CircleGeometry(0.32, 16);
        const mirrorMat = new THREE.MeshBasicMaterial({ color: 0x112140 });
        const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
        mirror.position.z = -0.7; // bottom of tube
        TELE_STATE.telescopeTube.add(mirror);

        // Counterweight bar
        const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 12);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x4f7fd6 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = -0.6; // points opposite to look direction
        TELE_STATE.telescopeTube.add(bar);

        // Counterweight block
        const weightGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 12);
        const weight = new THREE.Mesh(weightGeo, forkMat);
        weight.position.y = -0.75;
        TELE_STATE.telescopeTube.add(weight);

        // 10. Observation Beam (Child of Tube Group, points along Z axis)
       const beamGeo = new THREE.CylinderGeometry(0.02, 0.35, 1.0, 16, 1, true);
        beamGeo.translate(0, 0.5, 0); // Pivot at the bottom
        
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x4f7fd6,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        
        TELE_STATE.beam = new THREE.Mesh(beamGeo, beamMat);
        TELE_STATE.beam.rotation.x = Math.PI / 2; // Point along Z axis (rotated on the object, not baked into geometry, so scale.y still works)
        TELE_STATE.beam.position.z = 0.85; // Emanates from bezel aperture
        TELE_STATE.telescopeTube.add(TELE_STATE.beam);

        TELE_STATE.telescopeBase.add(TELE_STATE.telescopeTube);
    }

    function setupInteraction(container) {
        container.addEventListener('mousedown', (e) => {
            TELE_STATE.isDragging = true;
            TELE_STATE.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!TELE_STATE.isDragging) return;
            const deltaX = e.clientX - TELE_STATE.previousMousePosition.x;
            const deltaY = e.clientY - TELE_STATE.previousMousePosition.y;

            TELE_STATE.cameraRotation.theta -= deltaX * 0.005;
            TELE_STATE.cameraRotation.phi -= deltaY * 0.005;

            TELE_STATE.previousMousePosition = { x: e.clientX, y: e.clientY };
            updateCamera();
        });

        window.addEventListener('mouseup', () => {
            TELE_STATE.isDragging = false;
        });

        // Mobile touch support
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                TELE_STATE.isDragging = true;
                TELE_STATE.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!TELE_STATE.isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - TELE_STATE.previousMousePosition.x;
            const deltaY = e.touches[0].clientY - TELE_STATE.previousMousePosition.y;

            TELE_STATE.cameraRotation.theta -= deltaX * 0.005;
            TELE_STATE.cameraRotation.phi -= deltaY * 0.005;

            TELE_STATE.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            updateCamera();
        }, { passive: true });

        container.addEventListener('touchend', () => {
            TELE_STATE.isDragging = false;
        });

        // Zoom wheel support (limited)
        container.addEventListener('wheel', (e) => {
            if (TELE_STATE.isViewportVisible) {
                TELE_STATE.cameraRotation.radius += e.deltaY * 0.008;
                updateCamera();
                e.preventDefault();
            }
        }, { passive: false });
    }

    function updateCamera() {
        if (!TELE_STATE.camera) return;

        // Constraint: Prevent going below horizontal ground (phi limit) and prevent gimbal flip (theta limit)
        TELE_STATE.cameraRotation.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.08, TELE_STATE.cameraRotation.phi));
        TELE_STATE.cameraRotation.radius = Math.max(7.0, Math.min(16.0, TELE_STATE.cameraRotation.radius));

        const radius = TELE_STATE.cameraRotation.radius;
        const phi = TELE_STATE.cameraRotation.phi;
        const theta = TELE_STATE.cameraRotation.theta;

        TELE_STATE.camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
        TELE_STATE.camera.position.y = radius * Math.cos(phi) + 1.2; // vertical height offset
        TELE_STATE.camera.position.z = radius * Math.sin(phi) * Math.cos(theta);

        TELE_STATE.camera.lookAt(0, 1.2, 0); // Focus on axle elevation pivot
    }

    function setupButtons() {
        const pauseBtn = document.getElementById('vis-pause-btn');
        const resetBtn = document.getElementById('vis-reset-btn');

        if (pauseBtn) {
            // Respect prefers-reduced-motion for initial text state
            if (TELE_STATE.reducedMotion) {
                pauseBtn.textContent = 'Play Animation';
                pauseBtn.setAttribute('aria-pressed', 'true');
            } else {
                pauseBtn.textContent = 'Pause Animation';
                pauseBtn.setAttribute('aria-pressed', 'false');
            }

            pauseBtn.addEventListener('click', () => {
                TELE_STATE.isPaused = !TELE_STATE.isPaused;
                if (TELE_STATE.isPaused) {
                    pauseBtn.textContent = TELE_STATE.reducedMotion ? 'Play Animation' : 'Resume Animation';
                    pauseBtn.setAttribute('aria-pressed', 'true');
                } else {
                    pauseBtn.textContent = 'Pause Animation';
                    pauseBtn.setAttribute('aria-pressed', 'false');
                }
                toggleLoop();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                TELE_STATE.cameraRotation.theta = 0.8;
                TELE_STATE.cameraRotation.phi = 1.1;
                TELE_STATE.cameraRotation.radius = 14;
                updateCamera();
                if (TELE_STATE.reducedMotion || TELE_STATE.isPaused) {
                    renderSingleFrame();
                }
            });
        }
    }

    function setupObservers(wrapper) {
        // Tab visibility
        document.addEventListener('visibilitychange', () => {
            TELE_STATE.isTabActive = !document.hidden;
            toggleLoop();
        });

        // IntersectionObserver for checking viewport visibility
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    TELE_STATE.isViewportVisible = entry.isIntersecting;
                    toggleLoop();
                });
            }, { threshold: 0.1 });
            observer.observe(wrapper);
        } else {
            TELE_STATE.isViewportVisible = true;
            toggleLoop();
        }
    }

    function toggleLoop() {
        const canRun = TELE_STATE.isTabActive && TELE_STATE.isViewportVisible && !TELE_STATE.isPaused && !TELE_STATE.reducedMotion;
        if (canRun && !TELE_STATE.animationFrameId) {
            animateTelescopeScene();
        } else if (!canRun && TELE_STATE.animationFrameId) {
            cancelAnimationFrame(TELE_STATE.animationFrameId);
            TELE_STATE.animationFrameId = null;
        }
    }

    function animateTelescopeScene() {
        TELE_STATE.animationFrameId = requestAnimationFrame(animateTelescopeScene);

        // Update Satellite orbital coordinates
        TELE_STATE.satelliteOrbitAngle += 0.004;
        
        const satX = Math.cos(TELE_STATE.satelliteOrbitAngle) * TELE_STATE.orbitRadiusX;
        const satZ = Math.sin(TELE_STATE.satelliteOrbitAngle) * TELE_STATE.orbitRadiusZ;
        
        // 3D vector construction
        const satPos = new THREE.Vector3(satX, 0, satZ);
        satPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), TELE_STATE.orbitPlaneRotationX);
        satPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), TELE_STATE.orbitPlaneRotationZ);
        satPos.y += 2.0;

        if (TELE_STATE.satellite) {
            TELE_STATE.satellite.position.copy(satPos);
            // Rotate satellite for solar panel visual movement
            TELE_STATE.satellite.rotation.y += 0.01;
        }

        // Adjust Alt-Azimuth rotation to follow the satellite
        if (TELE_STATE.telescopeBase && TELE_STATE.telescopeTube && TELE_STATE.beam) {
            // Get pivot position of telescope tube
            const scopeWorldPos = new THREE.Vector3();
            TELE_STATE.telescopeTube.getWorldPosition(scopeWorldPos);

            // Compute tracking line vector
            const direction = new THREE.Vector3().subVectors(satPos, scopeWorldPos);
            const dist = direction.length();

            // Azimuth rotation (around global Y-axis)
            const azimuth = Math.atan2(direction.x, direction.z);
            TELE_STATE.telescopeBase.rotation.y = azimuth;

            // Local direction mapped to base coordinate platform
            const localDir = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -azimuth);
            // Elevation tilt (angle from horizontal Z axis up to local Y)
            const elevation = Math.atan2(localDir.y, localDir.z);
            TELE_STATE.telescopeTube.rotation.x = -elevation;

            // Scale observation beam length to reach the satellite
            const beamLength = Math.max(1.0, dist - 0.8);
            TELE_STATE.beam.scale.y = beamLength;
        }

        // Rotate starfield slowly
        if (TELE_STATE.starfield) {
            TELE_STATE.starfield.rotation.y -= 0.0003;
        }
        if (TELE_STATE.constellations) {
            TELE_STATE.constellations.rotation.y -= 0.0003;
        }

        // Render Scene
        if (TELE_STATE.renderer && TELE_STATE.scene && TELE_STATE.camera) {
            TELE_STATE.renderer.render(TELE_STATE.scene, TELE_STATE.camera);
        }
    }

    function renderSingleFrame() {
        // Position elements at start coordinates for a single frame
        TELE_STATE.satelliteOrbitAngle = 0.5;
        const satX = Math.cos(TELE_STATE.satelliteOrbitAngle) * TELE_STATE.orbitRadiusX;
        const satZ = Math.sin(TELE_STATE.satelliteOrbitAngle) * TELE_STATE.orbitRadiusZ;
        const satPos = new THREE.Vector3(satX, 0, satZ);
        satPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), TELE_STATE.orbitPlaneRotationX);
        satPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), TELE_STATE.orbitPlaneRotationZ);
        satPos.y += 2.0;

        if (TELE_STATE.satellite) TELE_STATE.satellite.position.copy(satPos);

        if (TELE_STATE.telescopeBase && TELE_STATE.telescopeTube && TELE_STATE.beam) {
            const scopeWorldPos = new THREE.Vector3();
            TELE_STATE.telescopeTube.getWorldPosition(scopeWorldPos);
            const direction = new THREE.Vector3().subVectors(satPos, scopeWorldPos);
            const dist = direction.length();
            const azimuth = Math.atan2(direction.x, direction.z);
            TELE_STATE.telescopeBase.rotation.y = azimuth;
            const localDir = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -azimuth);
            const elevation = Math.atan2(localDir.y, localDir.z);
            TELE_STATE.telescopeTube.rotation.x = -elevation;
            TELE_STATE.beam.scale.y = Math.max(1.0, dist - 0.8);
        }

        if (TELE_STATE.renderer && TELE_STATE.scene && TELE_STATE.camera) {
            TELE_STATE.renderer.render(TELE_STATE.scene, TELE_STATE.camera);
        }
    }

    function onResize() {
        const container = document.getElementById('telescope-canvas');
        if (!container || !TELE_STATE.renderer || !TELE_STATE.camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight || 480;

        TELE_STATE.camera.aspect = width / height;
        TELE_STATE.camera.updateProjectionMatrix();

        TELE_STATE.renderer.setSize(width, height);

        if (TELE_STATE.reducedMotion) {
            renderSingleFrame();
        }
    }

})();
