(function () {
    'use strict';

    // Global settings namespace or internal state
    const STATE = {
        scene: null,
        camera: null,
        renderer: null,
        earthGroup: null, // parent group to hold Earth, atmosphere, HUD, orbits, labels
        earth: null,
        clouds: null,
        atmosphere: null,
        starsFar: null,
        starsNear: null,
        satellites: [],
        orbits: [],
        scanningPulses: [],
        hudElements: [],
        labels: [],
        lights: {},
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        isPaused: false,
        isTabActive: true,
        isViewportVisible: true,
        animationFrameId: null,
        reducedMotion: false,
        sphereRadius: 6.1 // increased slightly (about 5% from 5.8)
    };

    // Initialize checking WebGL support
    function init() {
        const container = document.getElementById('earth-canvas');
        if (!container) return;

        // Check prefers-reduced-motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        STATE.reducedMotion = motionQuery.matches;
        motionQuery.addEventListener('change', (e) => {
            STATE.reducedMotion = e.matches;
        });

        // WebGL support check
        if (!isWebGLAvailable()) {
            showFallbackImage(container);
            return;
        }

        // Create Scene, Camera, Renderer
        STATE.scene = new THREE.Scene();

        const width = container.clientWidth;
        const height = container.clientHeight || 500;
        STATE.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        STATE.camera.position.z = 17.5; // Adjusted camera distance to frame the larger Earth beautifully

        STATE.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        STATE.renderer.setSize(width, height);
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        STATE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        STATE.renderer.toneMappingExposure = 1.1;
        container.appendChild(STATE.renderer.domElement);

        // Group container for Earth and its orbital system
        STATE.earthGroup = new THREE.Group();
        STATE.scene.add(STATE.earthGroup);

        // Shift Earth Group to the right on desktop (approx 50px left from right edge relative to original), center on mobile
        updateGroupPosition();

        // Lights - Improved for soft blue rim glow and scientific look
        STATE.lights.ambient = new THREE.AmbientLight(0x0c132c, 1.8);
        STATE.scene.add(STATE.lights.ambient);

        STATE.lights.dirLight = new THREE.DirectionalLight(0xffffff, 3.2);
        STATE.lights.dirLight.position.set(10, 4, 10);
        STATE.scene.add(STATE.lights.dirLight);

        // Ambient back-highlight for soft blue bloom
        STATE.lights.blueLight = new THREE.DirectionalLight(0x3a82f6, 3.5);
        STATE.lights.blueLight.position.set(-12, -4, -10);
        STATE.scene.add(STATE.lights.blueLight);

        // Textures setup with procedural generation as fallback
        const textureLoader = new THREE.TextureLoader();
        let earthTexture, normalTexture, cloudTexture;

        const onTextureLoaded = () => {
            buildEarth(earthTexture, normalTexture, cloudTexture);
            buildHUDOverlays();
            buildSSALabels();
        };

        // Try loading textures. If any fails, generate fallback canvas textures.
        Promise.all([
            loadTextureOrGenerateFallback(textureLoader, '/assets/earth-texture.jpg', generateProceduralEarthTexture),
            loadTextureOrGenerateFallback(textureLoader, '/assets/earth-normal.jpg', generateProceduralNormalTexture),
            loadTextureOrGenerateFallback(textureLoader, '/assets/earth-clouds.png', generateProceduralCloudTexture)
        ]).then(([earthTex, normalTex, cloudTex]) => {
            earthTexture = earthTex;
            normalTexture = normalTex;
            cloudTexture = cloudTex;
            onTextureLoaded();
        }).catch(() => {
            earthTexture = generateProceduralEarthTexture();
            normalTexture = generateProceduralNormalTexture();
            cloudTexture = generateProceduralCloudTexture();
            onTextureLoaded();
        });

        // Add Stars Background (Split into two layers for 3D parallax depth)
        buildStarfields();

        // Add Enriched Localized Orbital Rings and Satellites
        buildOrbitsAndSatellites();

        // Listeners
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousemove', onMouseMove);

        // Tab visibility observer
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Viewport intersection observer to pause when not visible
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    STATE.isViewportVisible = entry.isIntersecting;
                    toggleAnimationLoop();
                });
            }, { threshold: 0.1 });
            observer.observe(container);
        } else {
            STATE.isViewportVisible = true;
            toggleAnimationLoop();
        }

        // Start Loop
        toggleAnimationLoop();
    }

    function updateGroupPosition() {
        if (!STATE.earthGroup) return;
        const w = window.innerWidth;
        if (w < 768) {
            STATE.earthGroup.position.set(0, -1.0, 0);
        } else if (w < 992) {
            STATE.earthGroup.position.set(0.6, 0, 0);
        } else {
            // Shifted slightly to the left relative to previous 2.4 for comfortable right edge breathing room
            STATE.earthGroup.position.set(1.5, 0, 0);
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

    function showFallbackImage(container) {
        container.innerHTML = '';
        container.style.backgroundImage = "url('/assets/images2.jpeg')";
        container.style.backgroundSize = "cover";
        container.style.backgroundPosition = "center";
        container.style.opacity = "0.7";
        container.style.borderRadius = "14px";
    }

    async function loadTextureOrGenerateFallback(loader, url, fallbackGen) {
        return new Promise((resolve) => {
            loader.load(
                url,
                (texture) => resolve(texture),
                undefined,
                () => {
                    console.warn(`Texture: "${url}" not found. Creating a procedural scientific texture instead.`);
                    resolve(fallbackGen());
                }
            );
        });
    }

    // Procedural texture generators
    function generateProceduralEarthTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Draw deep space navy background
        ctx.fillStyle = '#060d22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw scientific latitude/longitude grid lines
        ctx.strokeStyle = 'rgba(79, 127, 214, 0.12)';
        ctx.lineWidth = 1;
        const gridStep = 32;
        for (let x = 0; x < canvas.width; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Draw stylized continents
        ctx.fillStyle = '#0d1e3d';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;

        const continents = [
            [[100, 100], [250, 80], [300, 150], [280, 250], [220, 280], [180, 200], [120, 180]],
            [[220, 280], [280, 310], [260, 420], [220, 480], [190, 420]],
            [[500, 80], [700, 60], [900, 80], [950, 180], [800, 240], [700, 180], [550, 190], [500, 120]],
            [[520, 200], [640, 210], [660, 300], [600, 420], [570, 430], [520, 300]],
            [[800, 350], [900, 360], [880, 420], [810, 400]],
            [[380, 40], [440, 50], [420, 90], [370, 70]]
        ];

        continents.forEach(points => {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            points.forEach((p, index) => {
                if (index > 0) ctx.lineTo(p[0], p[1]);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // Add glowing scientific dots at tracking observatories
        ctx.fillStyle = '#60a5fa';
        const sites = [[200, 150], [580, 160], [720, 130], [850, 380], [700, 165]];
        sites.forEach(site => {
            ctx.beginPath(); ctx.arc(site[0], site[1], 4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(site[0], site[1], 8, 0, Math.PI * 2); ctx.stroke();
        });

        return new THREE.CanvasTexture(canvas);
    }

    function generateProceduralNormalTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return new THREE.CanvasTexture(canvas);
    }

    function generateProceduralCloudTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = 60 + Math.random() * (canvas.height - 120);
            const r = 40 + Math.random() * 90;

            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        return new THREE.CanvasTexture(canvas);
    }

    function buildEarth(earthTexture, normalTexture, cloudTexture) {
        if (!STATE.scene || !STATE.earthGroup) return;

        const sphereRadius = STATE.sphereRadius;
        const segments = 64;

        const earthGeo = new THREE.SphereGeometry(sphereRadius, segments, segments);
        const earthMat = new THREE.MeshStandardMaterial({
            map: earthTexture,
            normalMap: normalTexture,
            normalScale: new THREE.Vector2(0.35, 0.35),
            roughness: 0.75,
            metalness: 0.15
        });
        STATE.earth = new THREE.Mesh(earthGeo, earthMat);
        STATE.earth.renderOrder = 1;
        STATE.earthGroup.add(STATE.earth);

        // Cloud Layer
        const cloudGeo = new THREE.SphereGeometry(sphereRadius + 0.08, segments, segments);
        const cloudMat = new THREE.MeshPhongMaterial({
            map: cloudTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            opacity: 0.42,
            depthWrite: false
        });
        STATE.clouds = new THREE.Mesh(cloudGeo, cloudMat);
        STATE.clouds.renderOrder = 1.1;
        STATE.earth.add(STATE.clouds);

        // Atmospheric Rim Lighting (Soft blue bloom)
        const atmosphereGeo = new THREE.SphereGeometry(sphereRadius + 0.45, segments, segments);
        const atmosphereMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    // Soft gradient curve for cinematic rim glow
                    float intensity = pow(0.70 - dot(vNormal, vec3(0, 0, 1.0)), 3.2);
                    gl_FragColor = vec4(0.35, 0.60, 1.0, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });
        STATE.atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
        STATE.atmosphere.renderOrder = 1.2;
        STATE.earthGroup.add(STATE.atmosphere);
    }

    function buildStarfields() {
        const isMobile = window.innerWidth < 768;
        
        // 1. Far Star Layer (dense, tiny, slow parallax)
        const countFar = isMobile ? 200 : 700;
        const geomFar = new THREE.BufferGeometry();
        const posFar = new Float32Array(countFar * 3);
        
        for (let i = 0; i < countFar; i++) {
            const u = Math.random(); const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const radius = 90 + Math.random() * 30;

            posFar[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            posFar[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            posFar[i * 3 + 2] = radius * Math.cos(phi);
        }
        geomFar.setAttribute('position', new THREE.BufferAttribute(posFar, 3));
        
        const matFar = new THREE.PointsMaterial({
            size: 0.3,
            color: 0x88aaff,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });
        STATE.starsFar = new THREE.Points(geomFar, matFar);
        STATE.starsFar.renderOrder = 0;
        STATE.scene.add(STATE.starsFar);

        // 2. Near Star Layer (brighter, larger, more distinct parallax)
        const countNear = isMobile ? 80 : 250;
        const geomNear = new THREE.BufferGeometry();
        const posNear = new Float32Array(countNear * 3);
        
        for (let i = 0; i < countNear; i++) {
            const u = Math.random(); const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const radius = 55 + Math.random() * 35;

            posNear[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            posNear[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            posNear[i * 3 + 2] = radius * Math.cos(phi);
        }
        geomNear.setAttribute('position', new THREE.BufferAttribute(posNear, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(173, 216, 230, 0.8)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);
        const starTex = new THREE.CanvasTexture(canvas);

        const matNear = new THREE.PointsMaterial({
            size: 0.7,
            map: starTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        STATE.starsNear = new THREE.Points(geomNear, matNear);
        STATE.starsNear.renderOrder = 0;
        STATE.scene.add(STATE.starsNear);
    }

    function buildOrbitsAndSatellites() {
        if (!STATE.earthGroup) return;

        const sphereRadius = STATE.sphereRadius;

        // Radii constrained close to the Earth (max radius 8.8 instead of 14.5) to keep paths localized
        const orbitConfigs = [
            { radiusX: sphereRadius + 0.8, radiusY: sphereRadius + 0.6, angleZ: 0.35, angleY: 0.2, speed: 0.005, color: 0x4f7fd6, name: "LEO-A" },
            { radiusX: sphereRadius + 1.4, radiusY: sphereRadius + 1.1, angleZ: -0.45, angleY: 0.7, speed: 0.0035, color: 0x6b96e0, name: "LEO-B" },
            { radiusX: sphereRadius + 2.0, radiusY: sphereRadius + 1.6, angleZ: 1.0, angleY: -0.3, speed: 0.0025, color: 0x10b981, name: "MEO-A" },
            { radiusX: sphereRadius + 2.6, radiusY: sphereRadius + 2.1, angleZ: -1.1, angleY: -0.6, speed: 0.0016, color: 0x818cf8, name: "GEO-A" }
        ];

        const isMobile = window.innerWidth < 768;

        orbitConfigs.forEach((config, idx) => {
            // Draw orbit paths
            const points = [];
            const segments = isMobile ? 48 : 128;
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                const x = Math.cos(theta) * config.radiusX;
                const y = Math.sin(theta) * config.radiusY;
                points.push(new THREE.Vector3(x, y, 0));
            }

            const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const ringMaterial = new THREE.LineBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: isMobile ? 0.08 : 0.24,
                blending: THREE.AdditiveBlending
            });

            const ringMesh = new THREE.Line(ringGeometry, ringMaterial);
            ringMesh.rotation.z = config.angleZ;
            ringMesh.rotation.y = config.angleY;
            ringMesh.renderOrder = 2;
            STATE.earthGroup.add(ringMesh);
            STATE.orbits.push({ mesh: ringMesh, material: ringMaterial, initialOpacity: ringMaterial.opacity });

            if (isMobile && idx >= 2) return;
            if (idx >= 3) return; // limit to 3 main operational targets

            const satGroup = new THREE.Group();

            // Detailed Satellite body structure
            const satMesh = new THREE.Group();

            // 1. Central bus box
            const busGeo = new THREE.BoxGeometry(0.22, 0.22, 0.32);
            const busMat = new THREE.MeshPhongMaterial({
                color: 0xdddddd,
                emissive: 0x0f2447,
                specular: 0xffffff,
                shininess: 45
            });
            const bus = new THREE.Mesh(busGeo, busMat);
            bus.renderOrder = 3;
            satMesh.add(bus);

            // 2. Solar panels extending from sides
            const panelGeo = new THREE.BoxGeometry(0.68, 0.02, 0.2);
            const panelMat = new THREE.MeshPhongMaterial({
                color: 0x60a5fa,
                emissive: 0x07111e,
                specular: 0xffffff,
                shininess: 85
            });
            const leftPanel = new THREE.Mesh(panelGeo, panelMat);
            leftPanel.position.x = 0.4;
            leftPanel.renderOrder = 3;
            satMesh.add(leftPanel);

            const rightPanel = leftPanel.clone();
            rightPanel.position.x = -0.4;
            satMesh.add(rightPanel);

            // 3. Antenna dish pointing towards Earth
            const dishGeo = new THREE.CylinderGeometry(0, 0.1, 0.12, 8);
            const dishMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, shininess: 50 });
            const dish = new THREE.Mesh(dishGeo, dishMat);
            dish.rotation.x = Math.PI / 2;
            dish.position.z = -0.2;
            dish.renderOrder = 3;
            satMesh.add(dish);

            satGroup.add(satMesh);

            // Subtle blue navigation lights that blink slowly
            const navLightGeo = new THREE.SphereGeometry(0.08, 6, 6);
            const navLightMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
            const navLight = new THREE.Mesh(navLightGeo, navLightMat);
            navLight.position.set(0.18, 0.18, 0.18);
            satGroup.add(navLight);

            // Double side helper scanning ring
            const helperRingGeo = new THREE.RingGeometry(0.32, 0.42, 16);
            const helperRingMat = new THREE.MeshBasicMaterial({
                color: config.color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.3
            });
            const helperRing = new THREE.Mesh(helperRingGeo, helperRingMat);
            helperRing.renderOrder = 3;
            satGroup.add(helperRing);

            STATE.earthGroup.add(satGroup);
            STATE.satellites.push({
                group: satGroup,
                mesh: satMesh,
                navLight: navLight,
                config: config,
                angle: Math.random() * Math.PI * 2,
                pulse: Math.random() * 10
            });

            // Occasional scanning pulse traveling faster along this orbit path
            const pulseParticleGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const pulseParticleMat = new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending
            });
            const pulseParticle = new THREE.Mesh(pulseParticleGeo, pulseParticleMat);
            pulseParticle.renderOrder = 3;
            STATE.earthGroup.add(pulseParticle);
            STATE.scanningPulses.push({
                mesh: pulseParticle,
                config: config,
                angle: Math.random() * Math.PI * 2,
                speedMultiplier: 2.8 // sweeps faster than satellites
            });
        });
    }

    function buildHUDOverlays() {
        if (!STATE.earthGroup || window.innerWidth < 768) return;

        const sphereRadius = STATE.sphereRadius;

        // Faint rotating circular tracking rings behind the globe (z = -1.5)
        const bgRings = [sphereRadius + 0.4, sphereRadius + 1.0, sphereRadius + 1.8];
        bgRings.forEach(rad => {
            const ringGeo = new THREE.RingGeometry(rad, rad + 0.02, 64);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x4f7fd6,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.z = -1.5; // positioned behind globe
            ring.renderOrder = 2;
            STATE.earthGroup.add(ring);
            STATE.hudElements.push({ mesh: ring, type: 'bgRing', speed: (Math.random() > 0.5 ? 0.002 : -0.002) });
        });

        // Very subtle animated radar sweep behind the Earth (z = -1.5)
        const radarSweepGeo = new THREE.RingGeometry(sphereRadius + 0.1, sphereRadius + 1.5, 64, 1, 0, Math.PI * 0.45);
        const radarSweepMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const radarSweep = new THREE.Mesh(radarSweepGeo, radarSweepMat);
        radarSweep.position.z = -1.5; // positioned behind globe
        radarSweep.renderOrder = 2;
        STATE.earthGroup.add(radarSweep);
        STATE.hudElements.push({ mesh: radarSweep, type: 'radarSweepBack', speed: 0.008 });
    }

    function buildSSALabels() {
        if (!STATE.earthGroup || window.innerWidth < 768) return;

        // Labels connected dynamically to moving satellites
        const labelNames = ["SAT-LEO-01", "SAT-MEO-02", "SAT-GEO-03"];

        labelNames.forEach((text, idx) => {
            const labelGroup = new THREE.Group();

            // Create Canvas Texture for HUD labels
            const canvas = document.createElement('canvas');
            canvas.width = 120; canvas.height = 30;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(6, 13, 34, 0.85)';
            ctx.fillRect(0, 0, 120, 30);
            ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, 120, 30);
            
            ctx.fillStyle = '#60a5fa';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(text, 60, 18);

            const tex = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(1.5, 0.38, 1.0);
            sprite.renderOrder = 4;
            labelGroup.add(sprite);

            // Connect thin leader line from satellite position to floating label sprite
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x60a5fa,
                transparent: true,
                opacity: 0.35
            });
            const lineGeo = new THREE.BufferGeometry();
            lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); // 2 vertices, 3 dimensions each
            const line = new THREE.Line(lineGeo, lineMat);
            line.renderOrder = 4;
            labelGroup.add(line);

            STATE.earthGroup.add(labelGroup);
            STATE.labels.push({
                group: labelGroup,
                sprite: sprite,
                line: line,
                satIndex: idx, // binds label to satellite index
                pulse: idx * 2.0
            });
        });
    }

    function onWindowResize() {
        const container = document.getElementById('earth-canvas');
        if (!container || !STATE.renderer || !STATE.camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight || 500;

        STATE.camera.aspect = width / height;
        STATE.camera.updateProjectionMatrix();

        STATE.renderer.setSize(width, height);

        // Adjust shifting dynamically based on new client dimensions
        updateGroupPosition();
    }

    function onMouseMove(event) {
        STATE.targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
        STATE.targetMouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function handleVisibilityChange() {
        STATE.isTabActive = !document.hidden;
        toggleAnimationLoop();
    }

    function toggleAnimationLoop() {
        const shouldRun = STATE.isTabActive && STATE.isViewportVisible && !STATE.isPaused;
        if (shouldRun && !STATE.animationFrameId) {
            animate();
        } else if (!shouldRun && STATE.animationFrameId) {
            cancelAnimationFrame(STATE.animationFrameId);
            STATE.animationFrameId = null;
        }
    }

    function animate() {
        STATE.animationFrameId = requestAnimationFrame(animate);

        const motionSpeed = STATE.reducedMotion ? 0 : 1;
        const baseSpeed = 0.0006 * motionSpeed;

        // Earth & Clouds continuous rotations
        if (STATE.earth) {
            STATE.earth.rotation.y += baseSpeed;
        }
        if (STATE.clouds) {
            STATE.clouds.rotation.y += baseSpeed * 1.5;
        }

        // Starfield slow rotations + mouse parallax offsets
        STATE.mouseX += (STATE.targetMouseX - STATE.mouseX) * 0.04;
        STATE.mouseY += (STATE.targetMouseY - STATE.mouseY) * 0.04;

        if (STATE.starsFar) {
            STATE.starsFar.rotation.y -= baseSpeed * 0.08;
            STATE.starsFar.position.x = STATE.mouseX * 0.8;
            STATE.starsFar.position.y = -STATE.mouseY * 0.8;
        }
        if (STATE.starsNear) {
            STATE.starsNear.rotation.y -= baseSpeed * 0.12;
            STATE.starsNear.position.x = STATE.mouseX * 2.0;
            STATE.starsNear.position.y = -STATE.mouseY * 2.0;
        }

        // Satellites orbital loop updates
        STATE.satellites.forEach((sat) => {
            sat.angle += sat.config.speed * motionSpeed;
            const x = Math.cos(sat.angle) * sat.config.radiusX;
            const y = Math.sin(sat.angle) * sat.config.radiusY;

            const localPos = new THREE.Vector3(x, y, 0);
            localPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), sat.config.angleZ);
            localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), sat.config.angleY);
            sat.group.position.copy(localPos);

            // Blinking navigation lights (blinks slowly)
            if (sat.navLight) {
                sat.pulse += 0.05 * motionSpeed; // Slower light pulse frequency
                sat.navLight.visible = Math.sin(sat.pulse * 1.5) > 0;
            }
        });

        // Occasional scanning pulses travelling along orbit paths
        STATE.scanningPulses.forEach((pulse) => {
            pulse.angle += pulse.config.speed * pulse.speedMultiplier * motionSpeed;
            const x = Math.cos(pulse.angle) * pulse.config.radiusX;
            const y = Math.sin(pulse.angle) * pulse.config.radiusY;

            const localPos = new THREE.Vector3(x, y, 0);
            localPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), pulse.config.angleZ);
            localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), pulse.config.angleY);
            pulse.mesh.position.copy(localPos);
        });

        // Orbits gentle glow shimmer animation
        if (!STATE.reducedMotion) {
            const time = performance.now() * 0.001;
            
            STATE.orbits.forEach(orb => {
                const pulse = orb.initialOpacity + Math.sin(time * 1.5) * 0.05;
                orb.material.opacity = Math.max(0.04, Math.min(0.3, pulse));
            });

            // HUD Overlays & Radar Sweep rotations
            STATE.hudElements.forEach(hud => {
                if (hud.type === 'bgRing') {
                    hud.mesh.rotation.z += hud.speed;
                } else if (hud.type === 'radarSweepBack') {
                    hud.mesh.rotation.z += hud.speed;
                }
            });

            // Anchored Annotations connected to satellites via thin lines
            STATE.labels.forEach(lbl => {
                lbl.pulse += 0.02;
                
                // Get matching satellite pos
                const sat = STATE.satellites[lbl.satIndex];
                if (sat) {
                    const satPos = sat.group.position;
                    // Offset label card relative to satellite position
                    const labelPos = satPos.clone().add(new THREE.Vector3(1.1, 0.9, 0.3));
                    lbl.sprite.position.copy(labelPos);
                    
                    // Update connected leader line vertices dynamically
                    const positions = lbl.line.geometry.attributes.position.array;
                    positions[0] = satPos.x;
                    positions[1] = satPos.y;
                    positions[2] = satPos.z;
                    positions[3] = labelPos.x;
                    positions[4] = labelPos.y;
                    positions[5] = labelPos.z;
                    lbl.line.geometry.attributes.position.needsUpdate = true;
                    
                    // Soft label fade in/out
                    lbl.sprite.material.opacity = 0.65 + Math.sin(lbl.pulse) * 0.25;
                    lbl.line.material.opacity = 0.25 + Math.sin(lbl.pulse) * 0.15;
                }
            });

            // Slow atmospheric shimmer glow scale modulation
            if (STATE.atmosphere) {
                const atmosPulse = 1.0 + Math.sin(time * 0.8) * 0.004;
                STATE.atmosphere.scale.set(atmosPulse, atmosPulse, atmosPulse);
            }
        }

        // Camera damping based on mouse movement
        if (STATE.scene) {
            STATE.scene.rotation.y = STATE.mouseX * 0.07;
            STATE.scene.rotation.x = -STATE.mouseY * 0.07;
        }

        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        init();

        const mediaControl = document.getElementById('media-control');
        if (mediaControl) {
            mediaControl.addEventListener('click', () => {
                STATE.isPaused = !STATE.isPaused;
                const heroVideo = document.getElementById('hero-video');

                if (STATE.isPaused) {
                    mediaControl.setAttribute('aria-pressed', 'true');
                    mediaControl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                    mediaControl.setAttribute('title', 'Resume animation');
                    if (heroVideo && !heroVideo.paused) {
                        heroVideo.pause();
                    }
                } else {
                    mediaControl.setAttribute('aria-pressed', 'false');
                    mediaControl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                    mediaControl.setAttribute('title', 'Pause animation');
                    if (heroVideo && heroVideo.paused) {
                        heroVideo.play().catch(() => { });
                    }
                }
                toggleAnimationLoop();
            });
        }
    });

})();
