(function () {
    'use strict';

    // --------------------------------------------------------------
    // DEBUG_ORBITS — set to true here, or append ?orbitsDebug=1 to the
    // URL. Logs computed Kepler periods/angular velocities/radii to the
    // console, brightens orbit lines/satellites, and shows orbit-class
    // labels for verification. See buildOrbitsAndSatellites() below.
    // --------------------------------------------------------------
    const orbitDebugParam = new URLSearchParams(window.location.search).get('orbitsDebug');
    const DEBUG_ORBITS = orbitDebugParam === '1';

    // Global settings namespace or internal state
    const STATE = {
        scene: null,
        camera: null,
        renderer: null,
        earthGroup: null, // parent group to hold Earth, atmosphere, HUD, orbits, labels
        earth: null,
        clouds: null,
        atmosphere: null,
        sunGlint: null,
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
        sphereRadius: 6.1, // increased slightly (about 5% from 5.8)
        lastFrameTimeMs: undefined, // used only by the Kepler orbital system's delta-time clock, see animate()
        orbitLabelOverlay: null, // DOM element holding the projected LEO/MEO/GEO labels
        orbitLabels: [] // {el, planeGroup, sceneRadius} — see buildOrbitClassLabel/updateOrbitLabelPositions
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
        // FINAL DECISION on this tradeoff (confirmed explicitly after
        // trying the alternative): Earth's on-screen size takes priority
        // over fitting more of MEO/GEO into frame. At fov=45, z=18.5,
        // Earth is ~94.6% of its pre-orbital-feature size (the closest
        // achievable to "unchanged" while still fitting LEO). LEO
        // (sceneRadius ~7.06) comfortably fits with ~8.6% margin at this
        // distance. MEO (~15.68, ~49% visible) and GEO (~40.36, ~19%
        // visible) extend well beyond the visible frame — accepted.
        //
        // A previous attempt widened to fov=70/z=24.2 to get MEO fully
        // visible, which cost Earth down to ~72-76% of its original size.
        // That tradeoff was explicitly rejected in favor of this one.
        //
        // Orbit radii themselves are NOT compressed to compensate for any
        // of this — see buildOrbitsAndSatellites() for why compressing
        // them would visually break LEO (its true altitude is only 15.7%
        // of Earth's own radius, so any real compression collides it with
        // the atmosphere shell).
        STATE.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        STATE.camera.position.z = 18.5;

        STATE.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        STATE.renderer.setSize(width, height);
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        STATE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        STATE.renderer.toneMappingExposure = 1.0;
        container.appendChild(STATE.renderer.domElement);

        // Group container for Earth and its orbital system
        STATE.earthGroup = new THREE.Group();
        STATE.scene.add(STATE.earthGroup);

        // Shift Earth Group to the right on desktop (approx 50px left from right edge relative to original), center on mobile
        updateGroupPosition();

        // Lights - Improved for soft blue rim glow and scientific look.
        // Key light moved to the upper-left to match where the sun sprite
        // (sun-scene.js) actually sits on screen — the lit hemisphere and
        // bright limb now fall on the left edge of the globe instead of
        // the right, matching the reference composition.
        // Ambient intensity trimmed slightly (1.8 → 1.4) so the shadowed
        // hemisphere reads as genuinely dark, matching the reference's
        // high-contrast night side instead of a washed-out gray.
        STATE.lights.ambient = new THREE.AmbientLight(0x0c132c, 1.4);
        STATE.scene.add(STATE.lights.ambient);

        // z dropped from 9 → 1: at z:9 the light pointed heavily TOWARD
        // the camera, so nearly the entire visible hemisphere caught enough
        // of a dot-product with the light to read as "lit" — that's why the
        // whole globe looked evenly bright instead of showing a crescent.
        // The reference shows roughly 60% of the visible disc in shadow
        // with only a blown-out limb lit; a mostly side-on light (small z)
        // is what produces that — x/y unchanged, still upper-left.
        STATE.lights.dirLight = new THREE.DirectionalLight(0xffd9a3, 2.7);
        STATE.lights.dirLight.position.set(-13, 5, 1);
        STATE.scene.add(STATE.lights.dirLight);

        // Blue accent light kept on the SAME left side as the key light
        // (just offset in depth/height) so it adds a cool undertone right
        // next to the warm highlight, instead of lighting up a separate
        // rim on the right/bottom edge. z also dropped for the same reason
        // as the key light above — otherwise it fills in extra brightness
        // across the shadow side and fights the crescent effect.
        STATE.lights.blueLight = new THREE.DirectionalLight(0x3a82f6, 1.8);
        STATE.lights.blueLight.position.set(-9, -6, -1);
        STATE.scene.add(STATE.lights.blueLight);

        // Textures setup with procedural generation as fallback
        const textureLoader = new THREE.TextureLoader();
        let earthTexture, normalTexture, cloudTexture;

        const onTextureLoaded = () => {
            buildEarth(earthTexture, normalTexture, cloudTexture);
            buildSunGlint();
            buildHUDOverlays();
            buildSSALabels();
            buildLocationPin();
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

    function getOrbitDisplayScale() {
        const w = window.innerWidth;
        if (w < 768) return 0.82;
        if (w < 1200) return 0.90;
        return 1.0;
    }

    function updateOrbitScales() {
        if (!STATE.orbits) return;
        const scale = getOrbitDisplayScale();
        STATE.orbits.forEach(orb => {
            if (orb.planeGroup) {
                orb.planeGroup.scale.setScalar(scale);
            }
        });
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
        updateOrbitScales();
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

        // Anisotropic filtering keeps the surface texture sharp at the
        // grazing angles you see near the sphere's limb/edge — without
        // this, textures default to a low anisotropy and look noticeably
        // softer/blurrier away from dead-center, which is what stood out
        // when zooming in on the globe.
        const maxAniso = STATE.renderer ? STATE.renderer.capabilities.getMaxAnisotropy() : 1;
        [earthTexture, normalTexture, cloudTexture].forEach((tex) => {
            if (!tex) return;
            tex.anisotropy = maxAniso;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = true;
            tex.needsUpdate = true;
        });

        const earthMat = new THREE.MeshStandardMaterial({
            map: earthTexture,
            normalMap: normalTexture,
            normalScale: new THREE.Vector2(0.35, 0.35),
            roughness: 0.75,
            metalness: 0.15
        });
        STATE.earth = new THREE.Mesh(earthGeo, earthMat);
        STATE.earth.renderOrder = 1;

        // Start the globe already turned so India (using the ARIES/Manora
        // Peak, Nainital pin coordinates as the reference point) faces the
        // camera at load, instead of the default unrotated orientation
        // which happens to face the Americas. The continuous per-frame
        // spin in animate() then carries on seamlessly from this starting
        // orientation, so the very first thing visible is the front of
        // the globe over India, not partway through the rotation.
        const frontPoint = latLonToVector3(PIN_LAT, PIN_LON, 1);
        STATE.earth.rotation.y = -Math.atan2(frontPoint.x, frontPoint.z);

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

        // Atmospheric Rim Lighting — cool blue all around, with a warm
        // golden-white highlight concentrated on the side facing the sun
        // (matching STATE.lights.dirLight's direction), so the limb glow
        // reads as sunlit on the left edge rather than a flat blue halo.
        const atmosphereGeo = new THREE.SphereGeometry(sphereRadius + 0.45, segments, segments);
        const sunDir = STATE.lights.dirLight.position.clone().normalize();
        const atmosphereMat = new THREE.ShaderMaterial({
            uniforms: {
                sunDirection: { value: sunDir }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 sunDirection;
                varying vec3 vNormal;
                void main() {
                    // Base rim intensity from viewing angle, same as before
                    float baseIntensity = pow(0.70 - dot(vNormal, vec3(0, 0, 1.0)), 3.2);

                    // Fade the base rim down on the side facing away from
                    // the sun and keep it full-strength on the side facing
                    // it, so the glow reads as coming from the left where
                    // the sun actually is instead of ringing the whole
                    // silhouette evenly (which was showing up as an
                    // unwanted glow on the right/bottom edge).
                    float sunSigned = dot(vNormal, sunDirection);
                    float sideFactor = smoothstep(-0.6, 0.4, sunSigned);
                    vec3 baseColor = vec3(0.35, 0.60, 1.0) * baseIntensity * mix(0.16, 1.0, sideFactor);

                    // Warm golden-orange highlight, concentrated tightly on
                    // the side of the rim actually facing the sun
                    float sunFactor = max(0.0, sunSigned);
                    float sunIntensity = pow(sunFactor, 3.0) * 2.0;
                    vec3 warmColor = vec3(1.0, 0.74, 0.38) * (baseIntensity * sunIntensity);

                    gl_FragColor = vec4(baseColor + warmColor, baseIntensity * mix(0.16, 1.0, sideFactor) + sunIntensity * baseIntensity * 0.65);
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

    // ------------------------------------------------------------------
    // Sun Glint — a warm highlight plus a few thin reflecting rays at the
    // point on Earth's silhouette that faces the light most directly (the
    // left limb, since STATE.lights.dirLight now sits upper-left). Parented
    // to earthGroup, NOT the rotating earth mesh, so it stays anchored to
    // the light's direction rather than spinning with the surface texture.
    // ------------------------------------------------------------------
    function buildSunGlint() {
        if (!STATE.earthGroup || !STATE.lights.dirLight) return;

        const sphereRadius = STATE.sphereRadius;
        const lightDirFull = STATE.lights.dirLight.position.clone().normalize();

        // Project the light direction onto the camera-facing plane (drop
        // the view-axis component) and place the glint on Earth's actual
        // silhouette circle at that angle — NOT at the raw "sub-solar
        // point" (lightDir * sphereRadius), which lands well inside the
        // visible disc whenever the light sits partly in front of Earth
        // rather than directly off to the side, as it does here (z: 9).
        // This is what confines the highlight to the curved edge instead
        // of a blob in the middle of the front face.
        const rimXY = new THREE.Vector2(lightDirFull.x, lightDirFull.y);
        if (rimXY.lengthSq() < 0.0001) rimXY.set(1, 0);
        rimXY.normalize();
        const pushOut = sphereRadius + 0.08; // just outside the surface, avoids z-fighting
        const glintPos = new THREE.Vector3(rimXY.x * pushOut, rimXY.y * pushOut, 0);

        // Soft, wide golden-white glow sitting right on the lit limb
        const softCanvas = document.createElement('canvas');
        softCanvas.width = 256; softCanvas.height = 256;
        const softCtx = softCanvas.getContext('2d');
        const softGrad = softCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
        softGrad.addColorStop(0, 'rgba(255, 224, 175, 0.6)');
        softGrad.addColorStop(0.3, 'rgba(255, 190, 120, 0.32)');
        softGrad.addColorStop(0.6, 'rgba(255, 160, 80, 0.15)');
        softGrad.addColorStop(1, 'rgba(255, 150, 70, 0)');
        softCtx.fillStyle = softGrad;
        softCtx.fillRect(0, 0, 256, 256);

        const softTex = new THREE.CanvasTexture(softCanvas);
        const softMat = new THREE.SpriteMaterial({
            map: softTex,
            transparent: true,
            depthWrite: false,
            // depthTest re-enabled: this sprite is a FLAT billboard sitting
            // at the tangent point of a CURVED surface, so with depth
            // testing on, the parts of it that would fall "inside" Earth's
            // curvature away from that exact tangent point get correctly
            // occluded — that's what makes it hug the curve instead of
            // reading as a flat patch laid over the front of the globe.
            depthTest: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.7
        });
        const softGlow = new THREE.Sprite(softMat);
        softGlow.scale.set(1.1, 1.1, 1);
        softGlow.position.copy(glintPos);
        softGlow.renderOrder = 5.5;
        STATE.earthGroup.add(softGlow);

        // Small, sharp specular hotspot right at the terminator
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 240, 205, 0.95)');
        grad.addColorStop(0.2, 'rgba(255, 205, 135, 0.82)');
        grad.addColorStop(0.5, 'rgba(255, 175, 90, 0.42)');
        grad.addColorStop(1, 'rgba(255, 160, 70, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.75
        });
        const glint = new THREE.Sprite(mat);
        glint.scale.set(0.5, 0.5, 1);
        glint.position.copy(glintPos);
        glint.renderOrder = 6;
        STATE.earthGroup.add(glint);

        // A couple of very short "reflecting" streaks right at the glint
        // point — previously these were up to ~10 world units long (nearly
        // Earth's full diameter) with depth testing disabled, so they
        // painted straight across the globe's face ignoring its curvature.
        // Shrunk drastically and depth-tested so they can only ever read as
        // a tiny accent right on the curve, never a streak across the disc.
        const rayTexCanvas = document.createElement('canvas');
        rayTexCanvas.width = 128; rayTexCanvas.height = 128;
        const rctx = rayTexCanvas.getContext('2d');
        const rgrad = rctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        rgrad.addColorStop(0, 'rgba(255, 220, 170, 0.9)');
        rgrad.addColorStop(0.15, 'rgba(255, 195, 130, 0.5)');
        rgrad.addColorStop(0.5, 'rgba(255, 170, 100, 0.12)');
        rgrad.addColorStop(1, 'rgba(255, 170, 100, 0)');
        rctx.fillStyle = rgrad;
        rctx.fillRect(0, 0, 128, 128);
        const rayTex = new THREE.CanvasTexture(rayTexCanvas);

        const rayAngles = [-0.5, 0.15];
        const rays = [];
        rayAngles.forEach((rot, i) => {
            const rayMat = new THREE.SpriteMaterial({
                map: rayTex,
                transparent: true,
                depthWrite: false,
                depthTest: true,
                blending: THREE.AdditiveBlending,
                opacity: 0.16,
                rotation: rot
            });
            const rayLength = sphereRadius * (0.16 + i * 0.05);
            const raySprite = new THREE.Sprite(rayMat);
            raySprite.scale.set(rayLength, sphereRadius * 0.05, 1);
            raySprite.position.copy(glintPos);
            raySprite.renderOrder = 5.2;
            STATE.earthGroup.add(raySprite);
            rays.push({ sprite: raySprite, mat: rayMat, baseOpacity: 0.16 - i * 0.03 });
        });

        STATE.sunGlint = {
            sprite: glint, mat: mat,
            softSprite: softGlow, softMat: softMat,
            rays: rays,
            pulseT: Math.random() * 10
        };
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

    // ------------------------------------------------------------------
    // Kepler-driven LEO/MEO/GEO orbital system.
    //
    // IMPLEMENTATION NOTES (read before changing camera/orbit numbers):
    //
    // Scene radii are derived by normalizing REAL orbital altitudes
    // against the EXISTING Earth mesh's actual radius (STATE.sphereRadius,
    // read directly rather than hardcoded — see buildEarth() above, where
    // the sphere geometry is built from this same value):
    //   sceneRadius = (EARTH_RADIUS_KM + altitudeKm) / EARTH_RADIUS_KM * sphereRadius
    //
    // This is a TRUE linear scale — no artistic per-orbit compression.
    // I tested compressing GEO's displayed radius to avoid a camera
    // pull-back, but the math doesn't allow it: LEO's real altitude
    // (1000km) is only ~15.7% of Earth's own radius, so ANY meaningful
    // compression pushes LEO's ring inside the existing atmosphere shell
    // (sphereRadius + 0.45) — it starts overlapping visually at even mild
    // compression (verified: compression=0.5 already collides). Since
    // LEO can't be compressed without looking broken, and the spec
    // requires all three orbits to share one proportional scale, GEO is
    // unavoidably ~40 scene units out (6.6x Earth's radius) if LEO is to
    // look correct. That's why the camera FOV/distance were changed in
    // init() above instead — see the comment there for the exact numbers.
    //
    // SIMULATION_TIME_SCALE is the single global multiplier applied
    // identically to every orbit class's REAL angular velocity, so the
    // true LEO:MEO:GEO speed ratio is preserved exactly (only the
    // absolute pace is sped up for a watchable hero animation).
    // ------------------------------------------------------------------
    const MU_EARTH = 3.986004418e14; // m^3/s^2, Earth's standard gravitational parameter
    const EARTH_RADIUS_KM = 6371;
    // Chosen so LEO completes a full visual revolution in ~20s (a
    // graceful, watchable pace) — GEO's true period is ~13.7x LEO's, so
    // it naturally works out to ~4.5 min/revolution here. That's not an
    // arbitrary GEO-specific choice; it falls straight out of applying
    // this SAME multiplier to GEO's real period.
    const SIMULATION_TIME_SCALE = 320;

    // Computes real orbital period (Kepler's third law) and angular
    // velocity from an altitude in km. Returns everything in SI units
    // (meters, seconds, rad/s) plus the normalized Three.js scene radius.
    function computeOrbitPhysics(altitudeKm, sphereRadius) {
        const rKm = EARTH_RADIUS_KM + altitudeKm;
        const rMeters = rKm * 1000;
        const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(rMeters, 3) / MU_EARTH);
        const angularVelocityRealRadPerSec = (2 * Math.PI) / periodSeconds;
        const sceneRadius = (rKm / EARTH_RADIUS_KM) * sphereRadius;
        return { rKm, rMeters, periodSeconds, angularVelocityRealRadPerSec, sceneRadius };
    }

    function formatPeriod(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.round((seconds % 3600) / 60);
        if (hours >= 1) return `${hours}h ${mins}m`;
        return `${Math.round(seconds / 60)} min`;
    }

    function buildOrbitsAndSatellites() {
        if (!STATE.earthGroup) return;

        const sphereRadius = STATE.sphereRadius;
        const isMobile = window.innerWidth < 768;

        // Three orbital classes with physically representative altitudes.
        // Colors follow the spec's suggested hierarchy: LEO blue/cyan,
        // MEO a different blue/teal, GEO a subtle green/teal. Inclinations
        // are varied per class (GEO kept near-equatorial, as real GEO
        // satellites are) for genuine 3D geometry rather than flat
        // coplanar rings.
        const ORBIT_CLASSES = [
            {
                key: 'LEO', label: 'Low Earth Orbit', altitudeKm: 1000,
                color: 0x4f7fd6, inclinationDeg: 18, raanDeg: 10, preferredLabelAngleDeg: 50,
                satCount: isMobile ? 1 : 2, lineOpacity: isMobile ? 0.10 : 0.26
            },
            {
                key: 'MEO', label: 'Medium Earth Orbit', altitudeKm: 10000,
                color: 0x2ec4b6, inclinationDeg: 32, raanDeg: 75, preferredLabelAngleDeg: 170,
                satCount: isMobile ? 1 : 2, lineOpacity: isMobile ? 0.08 : 0.22
            },
            {
                key: 'GEO', label: 'Geostationary Orbit', altitudeKm: 35786,
                color: 0x5eead4, inclinationDeg: 4, raanDeg: 150, preferredLabelAngleDeg: 290,
                satCount: 1, lineOpacity: isMobile ? 0.07 : 0.20
            }
        ];

        if (DEBUG_ORBITS) {
            console.info('[orbits] SIMULATION_TIME_SCALE =', SIMULATION_TIME_SCALE, '(shared across all classes)');
        }

        const DISPLAY_ORBIT_RADII = {
            LEO: sphereRadius * 1.20,
            MEO: sphereRadius * 1.48,
            GEO: sphereRadius * 1.78
        };

        const initialScale = getOrbitDisplayScale();

        ORBIT_CLASSES.forEach((cls) => {
            const physics = computeOrbitPhysics(cls.altitudeKm, sphereRadius);
            const displayRadius = DISPLAY_ORBIT_RADII[cls.key];

            if (DEBUG_ORBITS) {
                console.info(
                    `[orbits] ${cls.key}  altitude=${cls.altitudeKm}km  r=${physics.rKm.toFixed(1)}km  ` +
                    `sceneRadius=${physics.sceneRadius.toFixed(3)}  period=${formatPeriod(physics.periodSeconds)} ` +
                    `(${physics.periodSeconds.toFixed(1)}s)  omega=${physics.angularVelocityRealRadPerSec.toExponential(4)}rad/s  ` +
                    `visualPeriod=${(physics.periodSeconds / SIMULATION_TIME_SCALE).toFixed(1)}s`
                );
            }

            // Per-class group carrying the inclination + RAAN rotation.
            // Both the orbit line AND its satellites are children of this
            // group, so the scene graph applies the 3D tilt automatically
            // — satellites only ever need their simple flat-circle local
            // position (x=r*cosθ, z=r*sinθ), matching the spec's math,
            // without manually reapplying rotation every frame.
            const planeGroup = new THREE.Group();
            planeGroup.rotation.x = THREE.MathUtils.degToRad(cls.inclinationDeg);
            planeGroup.rotation.y = THREE.MathUtils.degToRad(cls.raanDeg);
            planeGroup.scale.setScalar(initialScale);
            STATE.earthGroup.add(planeGroup);

            // Orbit path — built in the local XZ plane (Earth's equatorial
            // plane, matching STATE.earth's Y-axis spin), then tilted by
            // the planeGroup's own rotation above.
            const points = [];
            const segments = isMobile ? 64 : 160;
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    Math.cos(theta) * displayRadius,
                    0,
                    Math.sin(theta) * displayRadius
                ));
            }
            const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const ringMaterial = new THREE.LineBasicMaterial({
                color: cls.color,
                transparent: true,
                opacity: DEBUG_ORBITS ? Math.min(0.75, cls.lineOpacity * 3) : cls.lineOpacity,
                blending: THREE.AdditiveBlending
                // depthTest/depthWrite intentionally left at their THREE.js
                // defaults (both true) — this is a real 3D line in the
                // scene, not a flat orthographic overlay, so normal depth
                // testing against Earth's already-written depth buffer is
                // exactly what makes the ring correctly disappear behind
                // Earth's opaque surface where geometrically appropriate.
            });
            const ringMesh = new THREE.Line(ringGeometry, ringMaterial);
            ringMesh.renderOrder = 2;
            planeGroup.add(ringMesh);
            STATE.orbits.push({ mesh: ringMesh, material: ringMaterial, initialOpacity: ringMaterial.opacity, planeGroup: planeGroup });

            // Satellites for this class.
            for (let s = 0; s < cls.satCount; s++) {
                const satGroup = new THREE.Group();
                const satMesh = new THREE.Group();

                const busGeo = new THREE.BoxGeometry(0.22, 0.22, 0.32);
                const busMat = new THREE.MeshPhongMaterial({
                    color: 0xdddddd, emissive: 0x0f2447, specular: 0xffffff, shininess: 45
                });
                const bus = new THREE.Mesh(busGeo, busMat);
                bus.renderOrder = 3;
                satMesh.add(bus);

                const panelGeo = new THREE.BoxGeometry(0.68, 0.02, 0.2);
                const panelMat = new THREE.MeshPhongMaterial({
                    color: 0x60a5fa, emissive: 0x07111e, specular: 0xffffff, shininess: 85
                });
                const leftPanel = new THREE.Mesh(panelGeo, panelMat);
                leftPanel.position.x = 0.4;
                leftPanel.renderOrder = 3;
                satMesh.add(leftPanel);
                const rightPanel = leftPanel.clone();
                rightPanel.position.x = -0.4;
                satMesh.add(rightPanel);

                const dishGeo = new THREE.CylinderGeometry(0, 0.1, 0.12, 8);
                const dishMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, shininess: 50 });
                const dish = new THREE.Mesh(dishGeo, dishMat);
                dish.rotation.x = Math.PI / 2;
                dish.position.z = -0.2;
                dish.renderOrder = 3;
                satMesh.add(dish);

                satGroup.add(satMesh);

                const navLightGeo = new THREE.SphereGeometry(0.08, 6, 6);
                const navLightMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
                const navLight = new THREE.Mesh(navLightGeo, navLightMat);
                navLight.position.set(0.18, 0.18, 0.18);
                satGroup.add(navLight);

                const helperRingGeo = new THREE.RingGeometry(0.32, 0.42, 16);
                const helperRingMat = new THREE.MeshBasicMaterial({
                    color: cls.color, side: THREE.DoubleSide, transparent: true,
                    opacity: DEBUG_ORBITS ? 0.7 : 0.3
                });
                const helperRing = new THREE.Mesh(helperRingGeo, helperRingMat);
                helperRing.renderOrder = 3;
                satGroup.add(helperRing);

                // DEBUG_ORBITS: scale satellite markers up so they're
                // trivially easy to spot while verifying orbital motion.
                if (DEBUG_ORBITS) satGroup.scale.setScalar(2.2);

                planeGroup.add(satGroup);

                // Evenly spaced starting angles per class, plus a little
                // random offset so multi-satellite classes don't look
                // mechanically symmetric.
                const initialAngle = (s / cls.satCount) * Math.PI * 2 + Math.random() * 0.4;

                STATE.satellites.push({
                    group: satGroup,
                    mesh: satMesh,
                    navLight: navLight,
                    className: cls.key,
                    orbitRadius: displayRadius,
                    angularVelocityReal: physics.angularVelocityRealRadPerSec,
                    angle: initialAngle,
                    pulse: Math.random() * 10
                });
            }

            // Decorative "scanning pulse" — NOT a claimed real satellite
            // (no Kepler angular velocity), just a fast-traveling marker
            // along the path for a radar-sweep-like visual flourish, same
            // as the previous implementation. Parented to the same
            // planeGroup so it correctly follows the class's inclination.
            const pulseParticleGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const pulseParticleMat = new THREE.MeshBasicMaterial({
                color: 0x10b981, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending
            });
            const pulseParticle = new THREE.Mesh(pulseParticleGeo, pulseParticleMat);
            pulseParticle.renderOrder = 3;
            planeGroup.add(pulseParticle);
            STATE.scanningPulses.push({
                mesh: pulseParticle,
                orbitRadius: displayRadius,
                angle: Math.random() * Math.PI * 2,
                // Decorative sweep speed, deliberately NOT physics-derived
                // (unlike satellites above) — scaled relative to this
                // class's own real angular velocity so it still sweeps
                // proportionally faster on faster (LEO) orbits than
                // slower (GEO) ones, just for visual consistency.
                angularVelocityReal: physics.angularVelocityRealRadPerSec * 2.8
            });

            // "LEO / Low Earth Orbit / ~1,000 km" style orbit-class label
            // — real HTML/CSS DOM element positioned via camera
            // projection each frame (see buildOrbitClassLabel + the
            // updateOrbitLabelPositions() call in animate()), not an
            // in-scene Sprite. Hidden on mobile to avoid clutter, same as
            // the existing SSA labels.
            if (!isMobile) {
                buildOrbitClassLabel(cls, displayRadius, planeGroup);
            }
        });
    }

    // ------------------------------------------------------------------
    // Orbit-class labels — real DOM/CSS overlay, positioned via genuine
    // Three.js camera projection (vector.project(camera) -> NDC -> pixel
    // coordinates), NOT fixed CSS left/top values and NOT a fake
    // "capped radius" position like the previous implementation. Each
    // label's 3D anchor is a point actually ON that orbit's true ring —
    // for GEO specifically, whose ring mostly extends beyond the visible
    // frustum, the anchor is chosen (in recomputeOrbitLabelAnchors) as
    // whichever point on the real ring is currently closest to screen
    // center / most visible, so the label always sits on a genuinely
    // visible segment of that ring instead of floating at an arbitrary
    // guaranteed-visible-but-disconnected position.
    // ------------------------------------------------------------------
    function ensureLabelOverlay() {
        if (STATE.orbitLabelOverlay) return STATE.orbitLabelOverlay;
        const container = document.getElementById('earth-canvas');
        if (!container) return null;

        // Defensive: absolutely-positioned children need a positioned
        // ancestor. Only touches position if the container is currently
        // 'static' (the CSS default) — doesn't override anything
        // intentionally set.
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.overflow = 'hidden'; // labels that project outside the canvas bounds get clipped rather than spilling into surrounding page content
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '3';
        container.appendChild(overlay);
        STATE.orbitLabelOverlay = overlay;
        return overlay;
    }

    function buildOrbitClassLabel(cls, displayRadius, planeGroup) {
        const overlay = ensureLabelOverlay();
        if (!overlay) return;

        const hexColor = `#${cls.color.toString(16).padStart(6, '0')}`;
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.opacity = '0'; // set to a real value on the first updateOrbitLabelPositions() call, next frame
        el.style.transform = 'translate(-50%, -50%)';
        el.style.padding = '5px 10px';
        el.style.background = 'rgba(6, 13, 24, 0.72)';
        el.style.border = `1px solid ${hexColor}66`;
        el.style.borderRadius = '3px';
        el.style.fontFamily = 'monospace';
        el.style.whiteSpace = 'nowrap';
        el.style.lineHeight = '1.35';
        el.style.transition = 'opacity 0.15s ease-out';
        el.style.willChange = 'left, top, opacity';
        el.innerHTML = `
            <div style="font-size:13px; font-weight:bold; color:${hexColor};">${cls.key}</div>
            <div style="font-size:9px; color:rgba(220,235,250,0.8);">${cls.label}</div>
            <div style="font-size:8px; color:rgba(170,195,220,0.6);">~${cls.altitudeKm.toLocaleString()} km</div>
        `;
        overlay.appendChild(el);

        STATE.orbitLabels.push({
            el,
            key: cls.key,
            planeGroup,
            sceneRadius: displayRadius,
            preferredAngleDeg: cls.preferredLabelAngleDeg,
            // Approximate rendered footprint for collision checks —
            // matches the padding/font sizes above closely enough for
            // this purpose without depending on layout having settled.
            approxWidthPx: 128,
            approxHeightPx: 56
        });
    }

    // Called every frame from animate(), after render() (so matrixWorld is
    // guaranteed fresh for every object — see the note in
    // buildOrbitClassLabel's history for why a build-time-cached version
    // of this was buggy).
    //
    // Three things happen here, per label:
    //   1. Sample many angles around the orbit's TRUE ring, score each by
    //      (a) distance from that class's own preferred direction — LEO,
    //      MEO, GEO are spread 120° apart, which is what actually gives
    //      them distinct regions instead of all gravitating toward
    //      whichever point happens to be closest to screen center —
    //      (b) a heavy penalty if the point would land on top of Earth's
    //      own on-screen disc, (c) disqualification if behind the camera.
    //   2. Pick the best-scoring candidate, but keep the full ranked list
    //      around too.
    //   3. Sequential collision pass: after each label gets its
    //      provisional position, check its approximate screen bounding
    //      box against every label already placed this frame. If they
    //      overlap, walk down that label's own ranked candidate list
    //      (still respecting its preferred-direction bias, just relaxing
    //      it incrementally) until clear, or give up gracefully after a
    //      bounded number of attempts.
    function updateOrbitLabelPositions() {
        if (!STATE.camera || !STATE.renderer || !STATE.orbitLabels.length) return;

        const SAMPLE_COUNT = 72; // 5-degree steps around the ring
        const size = STATE.renderer.getSize(new THREE.Vector2());
        const EDGE_MARGIN = 0.90;
        const worldPos = new THREE.Vector3();

        // Earth's approximate on-screen center + angular radius (in NDC
        // units), recomputed fresh each frame — used so label candidates
        // that would land on top of the globe get penalized rather than
        // just picked because they happened to score well otherwise.
        let earthNdcCenter = null;
        let earthNdcRadius = 0;
        if (STATE.earthGroup) {
            const centerWorld = new THREE.Vector3();
            STATE.earthGroup.getWorldPosition(centerWorld);
            const centerNdc = centerWorld.clone().project(STATE.camera);
            if (centerNdc.z < 1) {
                const edgeWorld = new THREE.Vector3(STATE.sphereRadius, 0, 0);
                STATE.earthGroup.localToWorld(edgeWorld);
                const edgeNdc = edgeWorld.clone().project(STATE.camera);
                earthNdcCenter = centerNdc;
                earthNdcRadius = Math.hypot(edgeNdc.x - centerNdc.x, edgeNdc.y - centerNdc.y);
            }
        }

        function angleDiffDeg(a, b) {
            let d = Math.abs(a - b) % 360;
            return d > 180 ? 360 - d : d;
        }

        // Builds a ranked (best-first) list of candidate screen positions
        // for one label, biased toward its preferred direction and away
        // from Earth's disc.
        function rankCandidates(lbl) {
            const candidates = [];
            for (let i = 0; i < SAMPLE_COUNT; i++) {
                const thetaDeg = (i / SAMPLE_COUNT) * 360;
                const theta = THREE.MathUtils.degToRad(thetaDeg);
                worldPos.set(
                    Math.cos(theta) * (lbl.sceneRadius + 0.45),
                    0,
                    Math.sin(theta) * (lbl.sceneRadius + 0.45)
                );
                lbl.planeGroup.localToWorld(worldPos);
                const ndc = worldPos.clone().project(STATE.camera);
                if (ndc.z >= 1) continue; // behind camera, never usable

                const overEarth = earthNdcCenter &&
                    Math.hypot(ndc.x - earthNdcCenter.x, ndc.y - earthNdcCenter.y) < earthNdcRadius * 1.15;

                // Lower is better. Primary term: how far this angle is
                // from the class's own preferred direction (0-180). Heavy
                // flat penalty if it overlaps Earth's disc — large enough
                // to always lose to any non-overlapping candidate, but
                // finite so we still have a usable fallback if literally
                // every angle overlaps Earth somehow.
                const angleScore = angleDiffDeg(thetaDeg, lbl.preferredAngleDeg);
                const score = angleScore + (overEarth ? 500 : 0);

                candidates.push({ ndc, score, overEarth });
            }
            candidates.sort((a, b) => a.score - b.score);
            return candidates;
        }

        const placedBoxes = []; // {left, top, right, bottom} in pixel space, already-placed labels this frame

        function toPixelBox(ndc, lbl) {
            const clampedX = Math.max(-EDGE_MARGIN, Math.min(EDGE_MARGIN, ndc.x));
            const clampedY = Math.max(-EDGE_MARGIN, Math.min(EDGE_MARGIN, ndc.y));
            const px = (clampedX * 0.5 + 0.5) * size.x;
            const py = (-clampedY * 0.5 + 0.5) * size.y;
            return {
                px, py,
                left: px - lbl.approxWidthPx / 2,
                right: px + lbl.approxWidthPx / 2,
                top: py - lbl.approxHeightPx / 2,
                bottom: py + lbl.approxHeightPx / 2,
                wasClamped: clampedX !== ndc.x || clampedY !== ndc.y
            };
        }

        function boxesOverlap(a, b) {
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        }

        STATE.orbitLabels.forEach((lbl) => {
            const ranked = rankCandidates(lbl);

            if (!ranked.length) {
                lbl.el.style.opacity = '0';
                return;
            }

            // Walk the ranked list (best preferred-direction match first)
            // until we find one that doesn't collide with an
            // already-placed label, or run out of attempts.
            const MAX_ATTEMPTS = 20;
            let chosenBox = null;
            for (let i = 0; i < Math.min(MAX_ATTEMPTS, ranked.length); i++) {
                const box = toPixelBox(ranked[i].ndc, lbl);
                const collides = placedBoxes.some((other) => boxesOverlap(box, other));
                if (!collides) {
                    chosenBox = box;
                    break;
                }
                if (i === 0) chosenBox = box; // fallback: best-scored even if it collides, in case nothing else clears
            }

            placedBoxes.push(chosenBox);

            lbl.el.style.opacity = DEBUG_ORBITS ? '1' : (chosenBox.wasClamped ? '0.55' : '0.75');
            lbl.el.style.borderStyle = chosenBox.wasClamped ? 'dashed' : 'solid';
            lbl.el.style.left = `${chosenBox.px}px`;
            lbl.el.style.top = `${chosenBox.py}px`;
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

        // Labels connected dynamically to moving satellites. Indices
        // match buildOrbitsAndSatellites()'s push order: LEO satellites
        // first, then MEO, then GEO — index 0 is always the first LEO
        // satellite, and MEO's/GEO's starting index depends on how many
        // LEO/MEO satellites were actually built (2 each on desktop).
        const leoCount = STATE.satellites.filter(s => s.className === 'LEO').length;
        const meoCount = STATE.satellites.filter(s => s.className === 'MEO').length;
        const labelTargets = [
            { text: 'SAT-LEO-01', satIndex: 0 },
            { text: 'SAT-MEO-01', satIndex: leoCount },
            { text: 'SAT-GEO-01', satIndex: leoCount + meoCount }
        ].filter(t => STATE.satellites[t.satIndex]); // guard against any class having 0 satellites

        labelTargets.forEach(({ text, satIndex }) => {
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
                satIndex: satIndex, // binds label to satellite index
                pulse: satIndex * 2.0
            });
        });
    }

    // ------------------------------------------------------------------
    // ARIES LOCATION PIN — Manora Peak, Nainital, Uttarakhand, where ARIES
    // is physically located. Coordinates are approximate (~29.36N, 79.46E);
    // adjust PIN_LAT / PIN_LON below if you have more precise figures.
    //
    // The pin is added as a CHILD of STATE.earth (not earthGroup), so it
    // rotates together with the textured globe automatically — no manual
    // per-frame repositioning needed, and it naturally disappears behind
    // the sphere when rotated to the far side, like a real map marker.
    // ------------------------------------------------------------------
    const PIN_LAT = 29.36;
    const PIN_LON = 79.46;
    const PIN_LABEL = 'ARIES \u2022 Nainital';

    // Standard three.js lat/lon -> sphere position conversion, matching the
    // default UV mapping THREE.SphereGeometry uses for an equirectangular
    // world texture (this is what earth-texture.jpg is).
    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    function buildLocationPin() {
        if (!STATE.earth) return;

        const sphereRadius = STATE.sphereRadius;
        // Ground-contact point (where the pin's tip touches the surface)
        const groundPos = latLonToVector3(PIN_LAT, PIN_LON, sphereRadius + 0.015);
        const outwardDir = groundPos.clone().normalize();

        const pinGroup = new THREE.Group();
        pinGroup.position.copy(groundPos);

        // Soft pulsing golden "ping" halo, flat against the surface at the
        // pin's base — camera-facing sprite w/ radial gradient
        const ringCanvas = document.createElement('canvas');
        ringCanvas.width = 128; ringCanvas.height = 128;
        const ringCtx = ringCanvas.getContext('2d');
        const grad = ringCtx.createRadialGradient(64, 64, 10, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 176, 32, 0.55)');
        grad.addColorStop(0.55, 'rgba(255, 176, 32, 0.18)');
        grad.addColorStop(1, 'rgba(255, 176, 32, 0)');
        ringCtx.fillStyle = grad;
        ringCtx.fillRect(0, 0, 128, 128);

        const ringTex = new THREE.CanvasTexture(ringCanvas);
        const ringMat = new THREE.SpriteMaterial({
            map: ringTex,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0.85
        });
        const ring = new THREE.Sprite(ringMat);
        ring.scale.set(0.75, 0.75, 1);
        ring.renderOrder = 4.5;
        pinGroup.add(ring);

        // ---- Miniature telescope model, mounted and aimed skyward ----
        // Built pointing along local +Y, then a wrapper group rotates it so
        // +Y aligns with this globe point's outward normal — same trick as
        // before, just driving a telescope shape instead of a pin.
        const orientGroup = new THREE.Group();
        orientGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outwardDir);
        pinGroup.add(orientGroup);

        // Small pier/base the mount sits on
        const baseMat = new THREE.MeshPhongMaterial({ color: 0x2a3550, shininess: 30 });
        const baseGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.07, 16);
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.035;
        base.renderOrder = 5;
        orientGroup.add(base);

        // Mount pivot — this is the part that slowly rotates a few degrees
        // in animate(), like a telescope slewing to track across the sky
        const mountPivot = new THREE.Group();
        mountPivot.position.y = 0.07;
        orientGroup.add(mountPivot);

        // Fork arms holding the tube, same white/blue palette as the
        // orbiting satellite models elsewhere in this file
        const forkMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, specular: 0xffffff, shininess: 60 });
        const forkGeo = new THREE.BoxGeometry(0.045, 0.16, 0.045);
        const forkLeft = new THREE.Mesh(forkGeo, forkMat);
        forkLeft.position.set(0.09, 0.08, 0);
        forkLeft.renderOrder = 5;
        mountPivot.add(forkLeft);
        const forkRight = forkLeft.clone();
        forkRight.position.x = -0.09;
        mountPivot.add(forkRight);

        // The telescope tube itself, tilted up and outward toward space
        const tubeGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.5, 16);
        const tubeMat = new THREE.MeshPhongMaterial({ color: 0xeef1f8, specular: 0xffffff, shininess: 80 });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.position.set(0, 0.16, 0);
        tube.rotation.z = Math.PI / 2.6; // tilt ~62deg from vertical, aiming skyward
        tube.renderOrder = 5;
        mountPivot.add(tube);

        // Glinting blue "lens" at the open end — child of the tube itself so
        // it automatically inherits the tilt without any extra trig
        const lensGeo = new THREE.CircleGeometry(0.045, 16);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.rotation.x = -Math.PI / 2;
        lens.position.y = 0.26;
        lens.renderOrder = 5.1;
        tube.add(lens);

        // ---- Beacon beam: a thin glowing column shooting straight up into
        // space from the observatory site (along the surface normal, not
        // the tilted tube — a clean vertical beam reads as "this is where
        // observations originate" much more clearly than one following the
        // tube's aim angle). Fades out with height via a gradient texture. ----
        const beamHeight = 2.4;
        const beamGeo = new THREE.CylinderGeometry(0.13, 0.045, beamHeight, 20, 1, true);

        const beamCanvas = document.createElement('canvas');
        beamCanvas.width = 8; beamCanvas.height = 256;
        const beamCtx = beamCanvas.getContext('2d');
        const beamGrad = beamCtx.createLinearGradient(0, 256, 0, 0); // bottom (v=0) -> top (v=1)
        beamGrad.addColorStop(0, 'rgba(255, 209, 128, 0.85)');
        beamGrad.addColorStop(0.35, 'rgba(255, 190, 90, 0.35)');
        beamGrad.addColorStop(1, 'rgba(255, 176, 32, 0)');
        beamCtx.fillStyle = beamGrad;
        beamCtx.fillRect(0, 0, 8, 256);

        const beamTex = new THREE.CanvasTexture(beamCanvas);
        const beamMat = new THREE.MeshBasicMaterial({
            map: beamTex,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            opacity: 0.8
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 0.32 + beamHeight / 2; // base starts just above the telescope
        beam.renderOrder = 4.2;
        orientGroup.add(beam);

        // Sparkle at the beam's tip
        const sparkCanvas = document.createElement('canvas');
        sparkCanvas.width = 64; sparkCanvas.height = 64;
        const sparkCtx = sparkCanvas.getContext('2d');
        const sparkGrad = sparkCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        sparkGrad.addColorStop(0, 'rgba(255, 245, 220, 0.95)');
        sparkGrad.addColorStop(0.4, 'rgba(255, 214, 140, 0.5)');
        sparkGrad.addColorStop(1, 'rgba(255, 176, 32, 0)');
        sparkCtx.fillStyle = sparkGrad;
        sparkCtx.fillRect(0, 0, 64, 64);

        const sparkTex = new THREE.CanvasTexture(sparkCanvas);
        const sparkMat = new THREE.SpriteMaterial({
            map: sparkTex,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0.9
        });
        const spark = new THREE.Sprite(sparkMat);
        spark.scale.set(0.4, 0.4, 1);
        spark.position.y = 0.32 + beamHeight;
        spark.renderOrder = 4.3;
        orientGroup.add(spark);

        // Floating label, offset outward from the telescope — no background
        // box. Bold text with a dark outline baked into the texture keeps it
        // legible over both bright cloud cover and dark ocean.
        const labelLocalPos = outwardDir.clone().multiplyScalar(1.1);

        const dpr = 2; // supersample for crisp text at this sprite scale
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 320 * dpr; labelCanvas.height = 60 * dpr;
        const labelCtx = labelCanvas.getContext('2d');
        labelCtx.scale(dpr, dpr);
        labelCtx.textAlign = 'center';
        labelCtx.textBaseline = 'middle';
        labelCtx.font = 'bold 20px "Space Grotesk", sans-serif';
        labelCtx.lineJoin = 'round';
        labelCtx.strokeStyle = 'rgba(4, 8, 18, 0.9)';
        labelCtx.lineWidth = 6;
        labelCtx.strokeText(PIN_LABEL, 160, 30);
        labelCtx.fillStyle = '#ffe1a8';
        labelCtx.fillText(PIN_LABEL, 160, 30);

        const labelTex = new THREE.CanvasTexture(labelCanvas);
        labelTex.anisotropy = 4;
        const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false });
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.scale.set(2.4, 0.45, 1);
        labelSprite.position.copy(labelLocalPos);
        labelSprite.renderOrder = 6;
        pinGroup.add(labelSprite);

        // Leader line connecting the telescope to the label. Fixed relative
        // to pinGroup, so no per-frame updates needed.
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            outwardDir.clone().multiplyScalar(0.55),
            labelLocalPos
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.45 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 4.5;
        pinGroup.add(line);

        STATE.earth.add(pinGroup);
        STATE.locationPin = {
            group: pinGroup,
            ring: ring,
            ringMat: ringMat,
            mountPivot: mountPivot,
            beamMat: beamMat,
            sparkMat: sparkMat,
            pulseT: 0,
            scanT: 0
        };
    }

    function onWindowResize() {
        const container = document.getElementById('earth-canvas');
        if (!container || !STATE.renderer || !STATE.camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight || 500;

        STATE.camera.aspect = width / height;
        STATE.camera.updateProjectionMatrix();

        // Browser/page zoom changes window.devicePixelRatio, but this was
        // only ever read once at init — the canvas kept rendering at the
        // old (now-stale) resolution and got upscaled by the browser,
        // which is what caused the Earth's surface to look blurry after
        // zooming. Re-reading it here keeps the render crisp at any zoom
        // level.
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

        // Real delta time for the Kepler orbital system and Earth rotation
        const nowMs = performance.now();
        if (STATE.lastFrameTimeMs === undefined) STATE.lastFrameTimeMs = nowMs;
        const realDeltaSeconds = Math.min((nowMs - STATE.lastFrameTimeMs) / 1000, 0.1); // clamp to avoid huge jumps after tab-switch
        STATE.lastFrameTimeMs = nowMs;
        const simulatedDeltaSeconds = realDeltaSeconds * SIMULATION_TIME_SCALE;

        const EARTH_VISUAL_ROTATION_PERIOD = 90; // seconds
        const earthAngularSpeed = (Math.PI * 2) / EARTH_VISUAL_ROTATION_PERIOD;
        const baseSpeed = earthAngularSpeed * realDeltaSeconds * motionSpeed;

        // Earth & Clouds continuous rotations
        if (STATE.earth) {
            STATE.earth.rotation.y += baseSpeed;
        }
        if (STATE.clouds) {
            const cloudRelativeSpeed = earthAngularSpeed * 0.08;
            STATE.clouds.rotation.y += cloudRelativeSpeed * realDeltaSeconds * motionSpeed;
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

        // Satellites — Kepler-derived orbital motion. theta += omega *
        // simulatedElapsedTime, exactly as specified: real angular
        // velocity (rad/s) times the shared SIMULATION_TIME_SCALE times
        // real elapsed seconds. Position is a simple flat-circle local
        // coordinate (x=r*cosθ, z=r*sinθ) because the satellite's PARENT
        // (planeGroup, built in buildOrbitsAndSatellites) already carries
        // the inclination/RAAN rotation — the scene graph applies that
        // tilt automatically, so no manual per-frame rotation math is
        // needed here (unlike the old radiusX/radiusY/angleZ/angleY
        // approach this replaced).
        STATE.satellites.forEach((sat) => {
            sat.angle += sat.angularVelocityReal * simulatedDeltaSeconds * motionSpeed;
            sat.group.position.set(
                Math.cos(sat.angle) * sat.orbitRadius,
                0,
                Math.sin(sat.angle) * sat.orbitRadius
            );

            // Blinking navigation lights (blinks slowly)
            if (sat.navLight) {
                sat.pulse += 0.05 * motionSpeed; // Slower light pulse frequency
                sat.navLight.visible = Math.sin(sat.pulse * 1.5) > 0;
            }
        });

        // Decorative scanning pulses — same delta-time basis as
        // satellites for consistent motion smoothness, but explicitly
        // NOT treated as real orbital bodies (see the comment where these
        // are created).
        STATE.scanningPulses.forEach((pulse) => {
            pulse.angle += pulse.angularVelocityReal * simulatedDeltaSeconds * motionSpeed;
            pulse.mesh.position.set(
                Math.cos(pulse.angle) * pulse.orbitRadius,
                0,
                Math.sin(pulse.angle) * pulse.orbitRadius
            );
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
                    // Satellites are now children of each orbit's tilted
                    // planeGroup (inclination/RAAN rotation), not earthGroup
                    // directly — sat.group.position alone is in that
                    // tilted local frame. Label sprites/lines live in
                    // earthGroup's own (untilted) frame, so we need the
                    // satellite's true WORLD position converted into
                    // earthGroup's local space, not its raw local position.
                    const satWorldPos = new THREE.Vector3();
                    sat.group.getWorldPosition(satWorldPos);
                    const satPos = STATE.earthGroup.worldToLocal(satWorldPos);

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

            // Sun glint gentle sparkle — soft breathing scale/opacity on the
            // highlight and its reflecting rays, so the left-limb glow feels
            // alive rather than static
            if (STATE.sunGlint) {
                STATE.sunGlint.pulseT += 0.03;
                const pulse = 1.0 + Math.sin(STATE.sunGlint.pulseT) * 0.15;
                STATE.sunGlint.sprite.scale.set(0.5 * pulse, 0.5 * pulse, 1);
                STATE.sunGlint.mat.opacity = 0.6 + Math.sin(STATE.sunGlint.pulseT * 1.3) * 0.15;

                const softPulse = 1.0 + Math.sin(STATE.sunGlint.pulseT * 0.7) * 0.08;
                STATE.sunGlint.softSprite.scale.set(1.1 * softPulse, 1.1 * softPulse, 1);
                STATE.sunGlint.softMat.opacity = 0.55 + Math.sin(STATE.sunGlint.pulseT * 0.9) * 0.15;

                STATE.sunGlint.rays.forEach((ray, i) => {
                    ray.mat.opacity = ray.baseOpacity * (0.7 + Math.sin(STATE.sunGlint.pulseT * 0.8 + i) * 0.3);
                });
            }

            // ARIES location pin — gentle radar-ping pulse on the halo ring
            // (~3.5s period), a synced brightness pulse on the beacon beam,
            // plus a slow telescope slew (a few degrees back and forth)
            if (STATE.locationPin) {
                STATE.locationPin.pulseT += 0.03;
                const pingScale = 0.65 + Math.sin(STATE.locationPin.pulseT) * 0.18;
                STATE.locationPin.ring.scale.set(pingScale, pingScale, 1);
                STATE.locationPin.ringMat.opacity = 0.55 + Math.sin(STATE.locationPin.pulseT * 1.3) * 0.25;

                if (STATE.locationPin.beamMat) {
                    STATE.locationPin.beamMat.opacity = 0.65 + Math.sin(STATE.locationPin.pulseT) * 0.2;
                }
                if (STATE.locationPin.sparkMat) {
                    const sparkPulse = 0.75 + Math.sin(STATE.locationPin.pulseT) * 0.2;
                    STATE.locationPin.sparkMat.opacity = sparkPulse;
                }

                if (STATE.locationPin.mountPivot) {
                    STATE.locationPin.scanT += 0.006;
                    // Oscillates slowly across ~20 degrees total — reads as
                    // the telescope tracking/scanning, not spinning
                    STATE.locationPin.mountPivot.rotation.y = Math.sin(STATE.locationPin.scanT) * (Math.PI / 18);
                }
            }
        }

        // Camera damping based on mouse movement
        if (STATE.scene) {
            STATE.scene.rotation.y = STATE.mouseX * 0.07;
            STATE.scene.rotation.x = -STATE.mouseY * 0.07;
        }

        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
            // After render(), matrixWorld is guaranteed up to date for
            // every object (including this frame's mouse-parallax scene
            // rotation set just above) — projecting label anchors here
            // rather than before avoids a one-frame lag.
            updateOrbitLabelPositions();
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