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
        starLayers: [], // layered Points objects (dim/mid/bright) for twinkle animation
        constellationGroups: [], // { group, glowSprites: [{sprite, mat, baseOpacity, baseScale, phase, speed}] }
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
        // FOV widened from 45 -> 58 specifically to give the 4 distant
        // constellations (placed ~27-28deg off-axis from the default view,
        // see CONSTELLATION_DATA positions below) comfortable margin inside
        // the frustum. Camera position/orbit math, target, and the
        // telescope's own composition are untouched — this only reveals
        // more surrounding space, it doesn't move or zoom toward anything.
        TELE_STATE.camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 1000);
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

    // World positions for every constellation below were computed from
    // the camera's actual default basis vectors (forward/right/up, from
    // theta:0.8, phi:1.1, radius:14, target (0,1.2,0)) as an azimuth +
    // elevation offset from the camera's forward direction, then placed
    // along that ray at a fixed distance. This guarantees every entry
    // lands inside the camera's frustum (unlike eyeballed coordinates,
    // which can silently end up behind the camera) and inside the
    // starfield's own 25-85 unit shell (see buildStarfield). All 7 are
    // fixed world positions — nothing here ever moves or rotates.
    const CONSTELLATION_DATA = [
        {
            name: 'PLEIADES',
            position: { x: -7.27, y: -2.60, z: -33.14 }, // upper-left of default view
            scale: 2.6,
            brightestIndex: 4,
            stars: [
                { x: 0.0, y: 0.0, brightness: 0.75 },
                { x: 0.6, y: 0.3, brightness: 0.55 },
                { x: 0.3, y: 0.9, brightness: 0.5 },
                { x: -0.4, y: 0.6, brightness: 0.6 },
                { x: -0.2, y: -0.5, brightness: 1.0 }, // Alcyone (brightest)
                { x: 0.8, y: -0.2, brightness: 0.5 },
                { x: 1.1, y: 0.5, brightness: 0.45 }
            ],
            connections: [[0, 1], [1, 2], [0, 3], [0, 4], [4, 5], [5, 6]]
        },
        {
            name: 'ORION',
            position: { x: -31.60, y: -0.31, z: -13.73 }, // upper-right of default view
            scale: 3.0,
            brightestIndex: 6,
            stars: [
                { x: 0.9, y: 2.0, brightness: 0.65 },   // Betelgeuse (shoulder)
                { x: -0.7, y: 2.1, brightness: 0.55 },  // Bellatrix (shoulder)
                { x: 0.5, y: 0.6, brightness: 0.6 },    // Mintaka (belt)
                { x: 0.0, y: 0.5, brightness: 0.65 },   // Alnilam (belt)
                { x: -0.5, y: 0.4, brightness: 0.6 },   // Alnitak (belt)
                { x: 0.6, y: -1.6, brightness: 0.55 },  // Saiph (foot)
                { x: -0.8, y: -1.8, brightness: 1.0 }   // Rigel (foot, brightest)
            ],
            connections: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]]
        },
        {
            name: 'SCORPIUS',
            position: { x: 0.95, y: -20.10, z: -27.19 }, // lower-left of default view
            scale: 2.8,
            brightestIndex: 3,
            stars: [
                { x: 0.0, y: 2.0, brightness: 0.5 },
                { x: 0.4, y: 1.7, brightness: 0.45 },
                { x: -0.3, y: 1.6, brightness: 0.45 },
                { x: 0.1, y: 1.0, brightness: 1.0 }, // Antares (brightest)
                { x: 0.3, y: 0.3, brightness: 0.55 },
                { x: 0.6, y: -0.4, brightness: 0.5 },
                { x: 0.9, y: -1.0, brightness: 0.55 },
                { x: 1.3, y: -1.3, brightness: 0.6 },
                { x: 1.6, y: -1.0, brightness: 0.5 }
            ],
            connections: [[0, 3], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]]
        },
        {
            name: 'URSA MAJOR',
            position: { x: -26.55, y: -21.94, z: -0.19 }, // lower-right of default view
            scale: 2.4,
            brightestIndex: 1,
            stars: [
                { x: 0.0, y: 0.0, brightness: 0.6 },
                { x: 1.0, y: 0.1, brightness: 0.65 },
                { x: 1.1, y: 0.9, brightness: 0.55 },
                { x: 0.1, y: 0.9, brightness: 0.6 },
                { x: 1.8, y: 1.3, brightness: 0.5 },
                { x: 2.4, y: 1.9, brightness: 0.55 },
                { x: 2.9, y: 2.1, brightness: 1.0 } // Alkaid (brightest, handle tip)
            ],
            connections: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6]]
        },
        // 3 additional constellations filling out the rest of the visible
        // sky alongside the 4 above.
        {
            name: 'CASSIOPEIA',
            position: { x: -35.51, y: -8.21, z: -4.55 }, // far right of default view
            scale: 2.6,
            brightestIndex: 2,
            stars: [
                { x: 0.0, y: 0.0, brightness: 0.55 },   // Caph
                { x: 0.8, y: 0.8, brightness: 0.5 },    // Schedar
                { x: 1.6, y: 0.2, brightness: 0.9 },    // Gamma Cas (brightest, center of the W)
                { x: 2.4, y: 0.9, brightness: 0.55 },   // Ruchbah
                { x: 3.2, y: 0.1, brightness: 0.5 }     // Segin
            ],
            connections: [[0, 1], [1, 2], [2, 3], [3, 4]]
        },
        {
            name: 'CYGNUS',
            position: { x: -26.53, y: 1.60, z: -24.57 }, // upper-center of default view
            scale: 2.9,
            brightestIndex: 0,
            stars: [
                { x: 0.0, y: 2.5, brightness: 1.0 },    // Deneb (tail, brightest)
                { x: 0.0, y: 1.1, brightness: 0.55 },   // Sadr (wing junction)
                { x: -1.3, y: 0.35, brightness: 0.45 }, // Delta Cygni (wing)
                { x: 1.3, y: 0.35, brightness: 0.45 },  // Gienah (wing)
                { x: 0.0, y: -1.7, brightness: 0.6 }    // Albireo (head/beak)
            ],
            connections: [[0, 1], [1, 2], [1, 3], [1, 4]]
        },
        {
            name: 'LEO',
            position: { x: -10.51, y: -25.34, z: -16.91 }, // lower-center of default view
            scale: 2.5,
            brightestIndex: 0,
            stars: [
                { x: 0.0, y: 0.0, brightness: 1.0 },    // Regulus (brightest, front paw)
                { x: 0.3, y: 0.9, brightness: 0.5 },    // Algieba
                { x: 0.1, y: 1.7, brightness: 0.45 },   // Adhafera
                { x: -0.6, y: 1.9, brightness: 0.4 },   // Rasalas
                { x: 2.3, y: 0.3, brightness: 0.55 },   // Zosma
                { x: 3.0, y: -0.1, brightness: 0.6 }    // Denebola (tail)
            ],
            connections: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]]
        }
    ];

    // Soft radial-gradient sprite texture, reused for both star point
    // sprites and the brighter-star glow halos.
    function createGlowTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const c = size / 2;
        // Tight, punchy core so points read as crisp shiny dots rather
        // than soft blurred blobs — most of the falloff happens fast.
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.12, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.35, 'rgba(200, 220, 255, 0.45)');
        grad.addColorStop(1, 'rgba(140, 180, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    // Softer, wider falloff used only for the faint ambient halo behind
    // stars — separate from the crisp point texture above so the halo
    // reads as a subtle glow, not a duplicate blurry star.
    function createHaloTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const c = size / 2;
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, 'rgba(210, 225, 255, 0.9)');
        grad.addColorStop(0.4, 'rgba(150, 185, 255, 0.25)');
        grad.addColorStop(1, 'rgba(140, 180, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    // Builds one constellation as a self-contained Group: a Points object
    // for the stars (single draw call), LineSegments for the thin
    // connecting lines, one small additive glow Sprite behind the
    // brightest star, and a low-opacity text-label Sprite. Kept generic —
    // any entry in CONSTELLATION_DATA can be passed through this unchanged.
    function createConstellation(def, starTexture, haloTexture) {
        const group = new THREE.Group();
        group.position.set(def.position.x, def.position.y, def.position.z);

        // Stars (Points)
        const positions = new Float32Array(def.stars.length * 3);
        const colors = new Float32Array(def.stars.length * 3);
        def.stars.forEach((s, i) => {
            positions[i * 3] = s.x * def.scale;
            positions[i * 3 + 1] = s.y * def.scale;
            positions[i * 3 + 2] = 0;
            const b = 0.75 + s.brightness * 0.35; // brighter floor so every star reads as a shiny dot
            colors[i * 3] = b;
            colors[i * 3 + 1] = b * 0.98;
            colors[i * 3 + 2] = 1.0;
        });
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const starMat = new THREE.PointsMaterial({
            size: 0.8,
            map: starTexture,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });
        group.add(new THREE.Points(starGeo, starMat));

        // Connecting lines — thin, low-opacity, stable (never animated)
        const linePositions = [];
        def.connections.forEach(([a, b]) => {
            const sa = def.stars[a], sb = def.stars[b];
            linePositions.push(sa.x * def.scale, sa.y * def.scale, 0, sb.x * def.scale, sb.y * def.scale, 0);
        });
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x8fb4ff,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending
        });
        group.add(new THREE.LineSegments(lineGeo, lineMat));

        // Glow halo behind every star, sized and lit by that star's own
        // brightness value. Brighter stars get a bigger, more opaque glow
        // (reads as "closer"); dimmer stars get a small, faint glow
        // (reads as "farther away") — giving the cluster a sense of depth
        // instead of every dot looking like it sits on the same plane.
        // The brightest star in each constellation still stands out the
        // most since brightness feeds directly into both scale & opacity.
        const glowSprites = [];
        def.stars.forEach((s, i) => {
            const isBrightest = i === def.brightestIndex;
            const glowMat = new THREE.SpriteMaterial({
                map: haloTexture,
                color: 0xd6e6ff,
                transparent: true,
                opacity: 0.3 + s.brightness * 0.4,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const glowSprite = new THREE.Sprite(glowMat);
            // Small, tight halo — just enough to add a shine/rim of light
            // around each point star. Brightness still sets how big it
            // gets (nearer-reading stars), but kept far smaller than the
            // constellation's own scale so it never smears into a blob.
            const glowBaseScale = def.scale * (0.14 + s.brightness * 0.16) * (isBrightest ? 1.25 : 1.0);
            glowSprite.scale.set(glowBaseScale, glowBaseScale, 1);
            glowSprite.position.set(s.x * def.scale, s.y * def.scale, -0.05);
            group.add(glowSprite);
            glowSprites.push({
                sprite: glowSprite,
                mat: glowMat,
                baseOpacity: 0.3 + s.brightness * 0.4,
                baseScale: glowBaseScale,
                phase: Math.random() * Math.PI * 2,
                speed: 0.4 + Math.random() * 0.4
            });
        });

        // Small, unobtrusive name label
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 360;
        labelCanvas.height = 64;
        const lctx = labelCanvas.getContext('2d');
        lctx.font = '800 28px "Space Grotesk", sans-serif';
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        // Dark outline first so the name stays legible over bright stars
        // or a busy background, then a crisp white fill on top.
        lctx.lineWidth = 7;
        lctx.lineJoin = 'round';
        lctx.strokeStyle = 'rgba(2, 6, 16, 0.9)';
        lctx.strokeText(def.name, 180, 34);
        lctx.fillStyle = '#ffffff';
        lctx.fillText(def.name, 180, 34);
        const labelTex = new THREE.CanvasTexture(labelCanvas);
        const labelMat = new THREE.SpriteMaterial({
            map: labelTex,
            transparent: true,
            opacity: 1.0,
            depthWrite: false
        });
        const label = new THREE.Sprite(labelMat);
        label.scale.set(def.scale * 3.1, def.scale * 0.55, 1);
        // Positioned just outside the star cluster's own bounding area
        const ys = def.stars.map(s => s.y);
        const labelY = (Math.min(...ys) - 0.8) * def.scale;
        label.position.set(0, labelY, 0.05);
        group.add(label);

        return { group, glowSprites };
    }

    function buildStarfield() {
        const isMobile = window.innerWidth < 768;

        // Procedural star point texture, shared across every layer and
        // every constellation (one texture, many draw calls reuse it).
        const starTexture = createGlowTexture(16);
        // Softer halo texture, reused across every constellation's
        // per-star shine sprites.
        const haloTexture = createHaloTexture(32);

        // Everything starfield-related lives under one Group so the
        // existing single `starfield.rotation.y -= 0.0003` in
        // animateTelescopeScene() keeps working unchanged for all layers
        // at once.
        TELE_STATE.starfield = new THREE.Group();
        TELE_STATE.starLayers = [];

        // Three depth layers — dim/far, mid, and a few bright/near stars.
        // This is what gives "different sizes and brightness levels" and
        // the added sense of depth (brighter = nearer, by real-world
        // convention), rather than one uniform Points cloud.
        const layerDefs = [
            { count: isMobile ? 220 : 380, radiusMin: 55, radiusMax: 90, size: 0.32, opacity: 0.6, twinkleAmp: 0.08, twinkleSpeed: 0.15 },
            { count: isMobile ? 90 : 160, radiusMin: 38, radiusMax: 58, size: 0.55, opacity: 0.85, twinkleAmp: 0.1, twinkleSpeed: 0.22 },
            { count: isMobile ? 24 : 45, radiusMin: 26, radiusMax: 42, size: 0.95, opacity: 1.0, twinkleAmp: 0.14, twinkleSpeed: 0.3 },
            // Extra "near" layer — a handful of bigger, brighter shiny
            // dots scattered close in, reinforcing the sense that some
            // stars sit much nearer the camera than others.
            { count: isMobile ? 6 : 14, radiusMin: 18, radiusMax: 28, size: 1.3, opacity: 1.0, twinkleAmp: 0.16, twinkleSpeed: 0.35 }
        ];

        layerDefs.forEach((def) => {
            const positions = new Float32Array(def.count * 3);
            const colors = new Float32Array(def.count * 3);

            for (let i = 0; i < def.count; i++) {
                const u = Math.random();
                const v = Math.random();
                const t = u * 2.0 * Math.PI;
                const phi = Math.acos(2.0 * v - 1.0);
                const radius = def.radiusMin + Math.random() * (def.radiusMax - def.radiusMin);

                positions[i * 3] = radius * Math.sin(phi) * Math.cos(t);
                positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(t);
                positions[i * 3 + 2] = radius * Math.cos(phi);

                const tint = Math.random();
                colors[i * 3] = 0.85 + tint * 0.15;
                colors[i * 3 + 1] = 0.9 + tint * 0.1;
                colors[i * 3 + 2] = 1.0;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: def.size,
                vertexColors: true,
                map: starTexture,
                transparent: true,
                opacity: def.opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const points = new THREE.Points(geometry, material);
            TELE_STATE.starfield.add(points);
            TELE_STATE.starLayers.push({
                material,
                baseOpacity: def.opacity,
                amp: def.twinkleAmp,
                speed: def.twinkleSpeed,
                phase: Math.random() * Math.PI * 2
            });
        });

        TELE_STATE.scene.add(TELE_STATE.starfield);

        // The 4 named constellations — fixed world positions, added
        // directly to the scene (NOT nested under the rotating starfield
        // Group above), so they never move or rotate, per spec.
        TELE_STATE.constellationGroups = CONSTELLATION_DATA.map((def) => {
            const built = createConstellation(def, starTexture, haloTexture);
            TELE_STATE.scene.add(built.group);
            return built;
        });
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

        // Rotate starfield slowly (unchanged existing behavior — now
        // rotates all 3 depth layers together since they're grouped)
        if (TELE_STATE.starfield) {
            TELE_STATE.starfield.rotation.y -= 0.0003;
        }

        // Slow, almost imperceptible starfield twinkle — each depth layer
        // breathes its opacity around its base value at its own slow,
        // independent frequency (not moving/scaling anything, just a very
        // small opacity wobble), so the whole sky doesn't pulse in unison.
        const nowSec = performance.now() / 1000;
        TELE_STATE.starLayers.forEach((layer) => {
            layer.material.opacity = layer.baseOpacity + Math.sin(nowSec * layer.speed + layer.phase) * layer.amp;
        });

        // Constellations stay completely fixed (no position/rotation
        // changes, per spec) — only the single glow halo behind each
        // constellation's brightest star gently pulses in place.
        TELE_STATE.constellationGroups.forEach(({ glowSprites }) => {
            glowSprites.forEach((g) => {
                const pulse = 1 + Math.sin(nowSec * g.speed + g.phase) * 0.18;
                g.mat.opacity = g.baseOpacity * pulse;
                g.sprite.scale.set(g.baseScale * pulse, g.baseScale * pulse, 1);
            });
        });

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