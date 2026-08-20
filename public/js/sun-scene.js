(function () {
    'use strict';

    // Parse URL parameter for progressive build stage
    const urlParams = new URLSearchParams(window.location.search);
    const stageParam = urlParams.get('sunStage');
    const isDebugMode = stageParam !== null;
    // CRITICAL WORKFLOW: Moving to Stage 9 for lens flares
    const defaultStage = 9; 
    const sunStage = isDebugMode ? Math.max(1, Math.min(14, parseInt(stageParam, 10))) : defaultStage;

    // Seeded random number generator for deterministic runs in debug mode
    let seed = 98765;
    function seededRandom() {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    function getRandom() {
        return isDebugMode ? seededRandom() : Math.random();
    }

    function stageEnabled(stage) {
        return sunStage >= stage;
    }

    const ENABLE_NASA_SUN_TEXTURE = false;

    const STATE = {
        scene: null,
        camera: null,
        renderer: null,
        sunGroup: null, // Everything belonging to the Sun centered here
        ambientGroup: null,
        sun: null, // The actual surface mesh
        // Future stages:
        // innerGlows: [],
        // outerHalo: null,
        // strongRays: [],
        // longRays: [],
        // fineRays: [],
        // horizontalFlare: null,
        // ambientLightMesh: null,
        // coronaSprites: [],
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        isPaused: false,
        isTabActive: true,
        isViewportVisible: true,
        animationFrameId: null,
        reducedMotion: false,
        sunRadius: 0.48,
        baseScale: 1.0,
        time: 0,
        stars: {
            materials: [],
            time: 0
        }
    };

    function init() {
        const container = document.getElementById('sun-canvas');
        if (!container) return;

        // Check prefers-reduced-motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        STATE.reducedMotion = motionQuery.matches;
        motionQuery.addEventListener('change', (e) => {
            STATE.reducedMotion = e.matches;
        });

        // Create Scene, Camera, Renderer
        STATE.scene = new THREE.Scene();

        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;

        const viewHeight = 12;
        const viewWidth = viewHeight * aspect;

        STATE.camera = new THREE.OrthographicCamera(
            -viewWidth / 2,
             viewWidth / 2,
             viewHeight / 2,
            -viewHeight / 2,
            0.1,
            1000
        );
        STATE.camera.position.set(0, 0, 20);
        STATE.camera.lookAt(0, 0, 0);

        STATE.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        STATE.renderer.setSize(width, height);
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        STATE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        STATE.renderer.toneMappingExposure = 0.9;

        container.appendChild(STATE.renderer.domElement);

        STATE.sunGroup = new THREE.Group();
        STATE.ambientGroup = new THREE.Group();
        STATE.scene.add(STATE.sunGroup);
        STATE.scene.add(STATE.ambientGroup);

        updateSunPosition();

        if (stageEnabled(1)) {
            // Stage 1: Debug Reference Position
            if (isDebugMode && sunStage === 1) {
                const gridHelper = new THREE.GridHelper(5, 10, 0xffaa00, 0x444444);
                gridHelper.rotation.x = Math.PI / 2;
                STATE.sunGroup.add(gridHelper);

                const axesHelper = new THREE.AxesHelper(3);
                STATE.sunGroup.add(axesHelper);
            }
        }

        buildSun();
        buildRichStarfield();

        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousemove', onMouseMove);
        document.addEventListener('visibilitychange', handleVisibilityChange);

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

        const mediaControl = document.getElementById('media-control');
        if (mediaControl) {
            mediaControl.addEventListener('click', () => {
                const isPaused = mediaControl.getAttribute('aria-pressed') === 'true';
                STATE.isPaused = isPaused;
                toggleAnimationLoop();
            });
        }

        toggleAnimationLoop();
    }

    function updateSunPosition() {
        if (!STATE.sunGroup || !STATE.ambientGroup || !STATE.camera) return;
        const w = window.innerWidth;
        
        const viewWidth = STATE.camera.right * 2;
        const viewHeight = STATE.camera.top * 2;

        let scale = 1.0;
        let px = -viewWidth * 0.22, py = viewHeight * 0.22;

        // Stage 13: Responsive behaviour (we'll implement the logic here early, but conditionally enable its effects later if needed)
        if (w < 768) { // Mobile
            px = -viewWidth * 0.11; py = viewHeight * 0.26;
            scale = 0.5;
        } else if (w < 992) { // Tablet
            px = -viewWidth * 0.13; py = viewHeight * 0.2;
            scale = 0.75;
        } else { // Desktop
            px = -viewWidth * 0.14; py = viewHeight * 0.18;
            scale = 1.0;
        }

        if (!stageEnabled(13)) scale = 1.0;

        STATE.baseScale = scale;
        STATE.sunGroup.position.set(px, py, 0);
        STATE.sunGroup.scale.setScalar(scale);

        STATE.ambientGroup.position.set(px + 6, py - 3, -5);
        STATE.ambientGroup.scale.setScalar(scale);
    }


    // Helper for bloom/corona sprites
    function createRadialGradientTexture(size, colorStops) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        colorStops.forEach(stop => gradient.addColorStop(stop.pos, stop.color));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    // Helper for soft volumetric streaks (cinematic lens flares)
    function createStreakTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // A perfectly smooth, ultra-soft radial gradient
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(255,255,255,1.0)');
        grad.addColorStop(0.05, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.3)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0.0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        
        return new THREE.CanvasTexture(canvas);
    }

    function buildSun() {
        if (!STATE.scene || !STATE.sunGroup) return;
        const r = STATE.sunRadius;

        // Stage 2: Plain SphereGeometry only
        if (stageEnabled(2)) {
            const geo = new THREE.SphereGeometry(STATE.sunRadius, 64, 64);
            let mat;
            
            // Stage 3: Basic yellow/orange Sun material
            if (sunStage === 2) {
                mat = new THREE.MeshBasicMaterial({ color: 0xffcc33, toneMapped: false });
            } else if (sunStage >= 3) {
                // Blown-out white core for cinematic lens flare
                mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
            } else {
                mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
            }
            
            STATE.sun = new THREE.Mesh(geo, mat);
            STATE.sun.position.set(0, 0, 0);
            STATE.sun.rotation.set(0, 0, 0);
            STATE.sun.scale.set(1, 1, 1);
            STATE.sun.renderOrder = 5;
            STATE.sunGroup.add(STATE.sun);

            console.log('Sun scale:', STATE.sun.scale.x, STATE.sun.scale.y, STATE.sun.scale.z);
            console.log('Sun world position:', STATE.sunGroup.position);
            console.log('Camera type:', STATE.camera.type);
        }

        // Stage 4: NASA Solar Surface Texture (Colorized to #E85D04)
        if (stageEnabled(4) && ENABLE_NASA_SUN_TEXTURE) {
            const imgLoader = new THREE.ImageLoader();
            imgLoader.load(
                '/assets/solarSphere304A.0200.jpg',
                (image) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(image, 0, 0);
                    
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imgData.data;
                    
                    // #E85D04 is rgb(232, 93, 4)
                    // We extract luminance and map it directly into the solar orange family
                    for (let i = 0; i < data.length; i += 4) {
                        const rStr = data[i];
                        const gStr = data[i + 1];
                        const bStr = data[i + 2];
                        
                        // Extract luminance (0 to 1)
                        let rawLum = (0.299 * rStr + 0.587 * gStr + 0.114 * bStr) / 255.0;
                        
                        // Increase local contrast using an S-curve to make plasma structures highly visible
                        let lum = rawLum * rawLum * (3 - 2 * rawLum);
                        
                        let outR, outG, outB;
                        
                        // Map the luminance (0.0 - 1.0) to specific unified orange palette
                        // base solar orange: #E85D04 (232, 93, 4)
                        // bright orange: #F97300 (249, 115, 0)
                        // hot highlight: #FF9A00 (255, 154, 0)
                        // edge highlight: #FFC247 (255, 194, 71)
                        if (lum <= 0.33) {
                            const t = lum / 0.33;
                            outR = 232 + t * (249 - 232);
                            outG = 93 + t * (115 - 93);
                            outB = 4 + t * (0 - 4);
                        } else if (lum <= 0.66) {
                            const t = (lum - 0.33) / 0.33;
                            outR = 249 + t * (255 - 249);
                            outG = 115 + t * (154 - 115);
                            outB = 0 + t * (0 - 0);
                        } else {
                            const t = (lum - 0.66) / 0.34;
                            outR = 255 + t * (255 - 255);
                            outG = 154 + t * (194 - 154);
                            outB = 0 + t * (71 - 0);
                        }
                        
                        data[i] = Math.min(255, outR);
                        data[i + 1] = Math.min(255, outG);
                        data[i + 2] = Math.min(255, outB);
                    }
                    
                    ctx.putImageData(imgData, 0, 0);
                    
                    const solarTexture = new THREE.CanvasTexture(canvas);
                    solarTexture.wrapS = THREE.RepeatWrapping;
                    solarTexture.wrapT = THREE.ClampToEdgeWrapping;
                    solarTexture.minFilter = THREE.LinearMipmapLinearFilter;
                    solarTexture.magFilter = THREE.LinearFilter;
                    
                    if (STATE.renderer && STATE.renderer.capabilities.getMaxAnisotropy() > 0) {
                        solarTexture.anisotropy = STATE.renderer.capabilities.getMaxAnisotropy();
                    }
                    
                    if (THREE.SRGBColorSpace) {
                        solarTexture.colorSpace = THREE.SRGBColorSpace;
                    } else if (THREE.sRGBEncoding) {
                        solarTexture.encoding = THREE.sRGBEncoding;
                    }
                    
                    if (STATE.sun && STATE.sun.material) {
                        STATE.sun.material.map = solarTexture;
                        STATE.sun.material.color.setHex(0xffffff); // Display colored canvas directly
                        STATE.sun.material.needsUpdate = true;
                        
                        // Rotate sphere to hide the seam at the back (Orthographic camera faces from +Z)
                        STATE.sun.rotation.y = Math.PI / 2;
                    }
                },
                undefined,
                (error) => {
                    console.warn('Failed to load solarSphere304A.0200.jpg — using #E85D04 fallback');
                }
            );
        }
        
        // Stage 5: Tight Inner Bloom
        if (stageEnabled(5)) {
            // Layer 1: Hot Inner Bloom
            // Scale: 2.5r (half-size is 1.25r). Sphere edge is at 1.0 / 1.25 = 0.8
            const hotBloomTex = createRadialGradientTexture(256, [
                { pos: 0.00, color: 'rgba(255, 194, 71, 0.0)' },
                { pos: 0.78, color: 'rgba(255, 194, 71, 0.0)' }, // Just inside the sphere
                { pos: 0.80, color: 'rgba(255, 170, 60, 0.50)' }, // Bright orange/yellow limb (#FFC247)
                { pos: 0.82, color: 'rgba(240, 130, 35, 0.36)' },  // Hot highlight (#FF9A00)
                { pos: 0.86, color: 'rgba(225, 105, 25, 0.22)' },  // Bright orange (#F97300)
                { pos: 0.92, color: 'rgba(210, 90, 20, 0.11)' },   // Base orange (#E85D04)
                { pos: 1.00, color: 'rgba(210, 90, 20, 0.0)' }     // Fade out
            ]);
            
            const hotBloomMat = new THREE.SpriteMaterial({
                map: hotBloomTex,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false
            });
            
            const hotBloom = new THREE.Sprite(hotBloomMat);
            hotBloom.scale.set(r * 2.5, r * 2.5, 1);
            STATE.sunGroup.add(hotBloom);

            // Layer 2: Soft Outer Bloom
            // Scale: 3.6r (half-size is 1.8r). Sphere edge is at 1.0 / 1.8 = 0.555
            const softBloomTex = createRadialGradientTexture(256, [
                { pos: 0.00, color: 'rgba(230, 130, 60, 0.0)' },
                { pos: 0.45, color: 'rgba(230, 130, 60, 0.0)' }, // Inside sphere
                { pos: 0.55, color: 'rgba(230, 140, 65, 0.40)' }, // Gold (#FFD60A)
                { pos: 0.70, color: 'rgba(220, 115, 50, 0.25)' },  // Orange (#F48C06)
                { pos: 0.85, color: 'rgba(205, 100, 40, 0.11)' },   // Deep orange (#E85D04)
                { pos: 1.00, color: 'rgba(205, 100, 40, 0.0)' }    // #E85D04
            ]);

            const softBloomMat = new THREE.SpriteMaterial({
                map: softBloomTex,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false
            });

            const softBloom = new THREE.Sprite(softBloomMat);
            softBloom.scale.set(r * 3.6, r * 3.6, 1);
            STATE.sunGroup.add(softBloom);
        }

        // Stage 5b: Ambient Haze — a soft warm wash behind the sun, tinting
        // the dark background nearby (touching the hero text a little) but
        // fading out well before reaching most of Earth — only its outer
        // edge should just touch Earth's left curve, not wash across the
        // globe. Kept modest in reach and darker/more saturated orange
        // rather than pale gold, per the reference.
        if (stageEnabled(5)) {
            const hazeTex = createRadialGradientTexture(512, [
                { pos: 0.00, color: 'rgba(235, 140, 60, 0.42)' },
                { pos: 0.20, color: 'rgba(225, 120, 50, 0.22)' },
                { pos: 0.45, color: 'rgba(210, 100, 40, 0.10)' },
                { pos: 0.70, color: 'rgba(195, 90, 35, 0.04)' },
                { pos: 1.00, color: 'rgba(195, 90, 35, 0.0)' }
            ]);
            const hazeMat = new THREE.SpriteMaterial({
                map: hazeTex,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                opacity: 0.5
            });
            const haze = new THREE.Sprite(hazeMat);
            // Modest reach — enough to touch the text and the near edge
            // of Earth, not wash across the whole scene.
            haze.scale.set(r * 9.0, r * 9.0, 1);
            haze.position.z = -4.0;
            STATE.sunGroup.add(haze);
        }
        
        // Stage 6: Outer Solar Corona
        if (stageEnabled(6)) {
            // Very soft, expansive luminous atmosphere starting outside the bloom
            // Entirely orange: #E85D04
            const coronaTex = createRadialGradientTexture(512, [
                { pos: 0.00, color: 'rgba(230, 140, 65, 0.0)' },
                { pos: 0.15, color: 'rgba(230, 140, 65, 0.0)' }, // Transparent inside sphere/inner bloom
                { pos: 0.25, color: 'rgba(225, 130, 55, 0.26)' }, // Warm gold — was a muddy burnt-orange
                { pos: 0.40, color: 'rgba(215, 110, 45, 0.15)' },  // Soft amber
                { pos: 0.60, color: 'rgba(205, 95, 38, 0.08)' },   // Light warm orange
                { pos: 0.80, color: 'rgba(195, 85, 32, 0.03)' },   // Faint warm edge
                { pos: 1.00, color: 'rgba(195, 85, 32, 0.0)' }
            ]);

            // Create 3 slightly irregular, overlapping corona layers by stretching and rotating
            // This prevents a perfectly mathematical circular ring
            const coronaConfigs = [
                { scaleX: 5.8, scaleY: 5.2, rot: 0, opacity: 0.55 },
                { scaleX: 6.5, scaleY: 5.5, rot: Math.PI / 3, opacity: 0.42 },
                { scaleX: 5.5, scaleY: 6.8, rot: -Math.PI / 4, opacity: 0.36 }
            ];

            coronaConfigs.forEach(config => {
                const coronaMat = new THREE.SpriteMaterial({
                    map: coronaTex,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    depthWrite: false,
                    rotation: config.rot,
                    opacity: config.opacity
                });

                const coronaSprite = new THREE.Sprite(coronaMat);
                // Diameter is ~2.5x to 3.5x the sun diameter (which means scale is 5r to 7r)
                coronaSprite.scale.set(r * config.scaleX, r * config.scaleY, 1);
                STATE.sunGroup.add(coronaSprite);
            });
        }
        
        // Stage 7: Massive Volumetric Light Shafts
        if (stageEnabled(7)) {
            const rayTex = createStreakTexture();
            const rayColors = [0xE8A868]; // darker warm orange, matching the reference's deeper tone
            const numShafts = 14; // Fewer, subtler shafts so they don't stack into a solid wash

            for (let i = 0; i < numShafts; i++) {
                // Spread rays beautifully in all directions
                const angle = getRandom() * Math.PI * 2; // full-circle scatter, not just a half-circle
                
                const length = r * (18.0 + 30.0 * getRandom()); // Massive length crossing the screen
                const width = r * (0.8 + 3.0 * getRandom()); // Soft, varying thickness
                const opacity = 0.035 + 0.05 * getRandom(); // Gentle, subtle rays
                const colorHex = rayColors[Math.floor(getRandom() * rayColors.length)];

                const rayMat = new THREE.SpriteMaterial({
                    map: rayTex,
                    color: colorHex,
                    transparent: true,
                    opacity: opacity,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    rotation: angle
                });

                const raySprite = new THREE.Sprite(rayMat);
                // When rotated by angle, X maps to length and Y maps to width
                raySprite.scale.set(length, width, 1);
                
                // Centered exactly on the sun so they radiate perfectly outwards in both directions
                raySprite.position.set(0, 0, -1.0); 
                
                STATE.sunGroup.add(raySprite);
            }
        }
        
        // Stage 8: Horizontal Anamorphic Lens Flare
        if (stageEnabled(8)) {
            const rayTex = createStreakTexture();
            
            // Base massive orange/gold horizontal flare
            const flareMat = new THREE.SpriteMaterial({
                map: rayTex,
                color: 0xE8A040,
                transparent: true,
                opacity: 0.24,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                rotation: -0.15 // Slightly tilted
            });
            const flareSprite = new THREE.Sprite(flareMat);
            flareSprite.scale.set(r * 90.0, r * 1.5, 1);
            flareSprite.position.set(0, 0, -2.0);
            STATE.sunGroup.add(flareSprite);

            // Core intense white/yellow horizontal flare
            const flareMatCore = new THREE.SpriteMaterial({
                map: rayTex,
                color: 0xF0B060, // Softened from pure white to edge highlight
                transparent: true,
                opacity: 0.28,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                rotation: -0.15
            });
            const flareSpriteCore = new THREE.Sprite(flareMatCore);
            flareSpriteCore.scale.set(r * 40.0, r * 0.6, 1);
            flareSpriteCore.position.set(0, 0, -1.5);
            STATE.sunGroup.add(flareSpriteCore);

            // Directional beam pointing towards Earth — built from two
            // overlapping sprites (a wide soft wash + a narrower brighter
            // core) rather than one hard-edged line, for a volumetric
            // "light scattering through space" feel. Kept modest in reach
            // and darker orange so it only touches Earth's near (left)
            // edge rather than washing across the globe.
            const earthFlareWideMat = new THREE.SpriteMaterial({
                map: rayTex,
                color: 0xE0904A,
                transparent: true,
                opacity: 0.16,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                rotation: -0.5 // Point down and right towards Earth
            });
            const earthFlareLength = r * 115.0;
            const earthFlareWide = new THREE.Sprite(earthFlareWideMat);
            earthFlareWide.scale.set(earthFlareLength, r * 18.0, 1); // Wide soft beam
            earthFlareWide.position.x = Math.cos(-0.5) * (earthFlareLength * 0.25);
            earthFlareWide.position.y = Math.sin(-0.5) * (earthFlareLength * 0.25);
            earthFlareWide.position.z = -2.6;
            STATE.sunGroup.add(earthFlareWide);

            const earthFlareMat = new THREE.SpriteMaterial({
                map: rayTex,
                color: 0xE8A868,
                transparent: true,
                opacity: 0.19,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                rotation: -0.5
            });
            const earthFlareSprite = new THREE.Sprite(earthFlareMat);
            earthFlareSprite.scale.set(earthFlareLength * 0.85, r * 7.0, 1); // Narrower, brighter core beam
            
            // Offset the sprite so the bright core sits on the Sun, but the tail only extends towards Earth
            earthFlareSprite.position.x = Math.cos(-0.5) * (earthFlareLength * 0.25);
            earthFlareSprite.position.y = Math.sin(-0.5) * (earthFlareLength * 0.25);
            earthFlareSprite.position.z = -2.5;
            STATE.sunGroup.add(earthFlareSprite);
        }

        // Stage 9: Circular Optical Ghosts
        if (stageEnabled(9)) {
            // Helper to make an empty circle with a rim
            const createRingTexture = (inner, outer) => {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(inner, 'rgba(255,255,255,0)');
                grad.addColorStop(outer, 'rgba(255,255,255,1)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 128, 128);
                const tex = new THREE.CanvasTexture(canvas);
                return tex;
            };

            const ring1 = createRingTexture(0.75, 0.9);
            const ring2 = createRingTexture(0.85, 0.95);
            
            // The ghosts travel diagonally down and right along the Earth vector
            const flareVector = new THREE.Vector3(Math.cos(-0.5), Math.sin(-0.5), 0).normalize();
            
            const ghosts = [
                { tex: ring1, dist: r * 8, size: r * 1.2, opacity: 0.15, color: 0xFFCE8A }, 
                { tex: ring2, dist: r * 15, size: r * 3.5, opacity: 0.08, color: 0xFFCE8A }, 
                { tex: ring1, dist: -r * 5, size: r * 0.8, opacity: 0.1, color: 0xFFCE8A }  
            ];

            ghosts.forEach(g => {
                const mat = new THREE.SpriteMaterial({
                    map: g.tex,
                    color: g.color,
                    transparent: true,
                    opacity: g.opacity,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const sprite = new THREE.Sprite(mat);
                sprite.scale.set(g.size, g.size, 1);
                sprite.position.copy(flareVector).multiplyScalar(g.dist);
                STATE.sunGroup.add(sprite);
            });
        }
    }

    // ------------------------------------------------------------------
    // Rich background starfield — spans the FULL hero canvas (this file's
    // #sun-canvas covers the entire hero, unlike three-scene.js's
    // starsFar/starsNear which only cover the right-hand Earth column).
    // Two tiers, same far/near approach as three-scene.js's own
    // buildStarfields() for visual consistency, adapted to this file's
    // flat orthographic camera: a dense/tiny/dim far layer plus a
    // sparser/brighter/glowing near layer, with a light per-star twinkle.
    // Positioned at very negative renderOrder so it always sits behind
    // the sun and its glow layers.
    // ------------------------------------------------------------------
    function createSoftStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
        grad.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    function buildRichStarfield() {
        if (!STATE.scene || !STATE.camera) return;

        const viewWidth = STATE.camera.right * 2;
        const viewHeight = STATE.camera.top * 2;
        const isMobile = window.innerWidth < 768;
        const starTex = createSoftStarTexture();

        function buildTier(cfg) {
            const count = isMobile ? Math.round(cfg.count * 0.45) : cfg.count;
            const positions = new Float32Array(count * 3);
            const sizes = new Float32Array(count);
            const opacities = new Float32Array(count);
            const phases = new Float32Array(count);

            for (let i = 0; i < count; i++) {
                // Spread generously beyond the visible frustum so nothing
                // pops in/out at the edges on resize. Deliberately spans
                // the whole canvas — around the Sun, between Sun and
                // Earth, above/below Earth, and the darker empty regions
                // — with no text-area masking, since tiny star points
                // don't hurt legibility the way a hazy cloud would.
                positions[i * 3] = (getRandom() - 0.5) * viewWidth * 1.3;
                positions[i * 3 + 1] = (getRandom() - 0.5) * viewHeight * 1.3;
                positions[i * 3 + 2] = cfg.z + (getRandom() - 0.5) * cfg.zJitter;

                sizes[i] = cfg.sizeMin + getRandom() * (cfg.sizeMax - cfg.sizeMin);
                opacities[i] = cfg.opacityMin + getRandom() * (cfg.opacityMax - cfg.opacityMin);
                phases[i] = getRandom() * Math.PI * 2.0;
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
            geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
            geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uTexture: { value: starTex },
                    uColor: { value: new THREE.Color(cfg.color) },
                    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                    uTime: { value: 0 },
                    uTwinkleAmount: { value: cfg.twinkleAmount }
                },
                vertexShader: `
                    attribute float aSize;
                    attribute float aOpacity;
                    attribute float aPhase;
                    uniform float uPixelRatio;
                    uniform float uTime;
                    uniform float uTwinkleAmount;
                    varying float vOpacity;
                    void main() {
                        // Gentle per-star twinkle — slow, low-amplitude,
                        // phase-offset per star so they don't pulse in unison.
                        float twinkle = 1.0 + sin(uTime * 0.6 + aPhase) * uTwinkleAmount;
                        vOpacity = aOpacity * twinkle;
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = aSize * uPixelRatio * twinkle;
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    uniform sampler2D uTexture;
                    uniform vec3 uColor;
                    varying float vOpacity;
                    void main() {
                        vec4 tex = texture2D(uTexture, gl_PointCoord);
                        gl_FragColor = vec4(uColor, tex.a * vOpacity);
                    }
                `,
                transparent: true,
                depthWrite: false,
                depthTest: false,
                blending: THREE.AdditiveBlending
            });

            const points = new THREE.Points(geo, mat);
            points.renderOrder = cfg.renderOrder;
            STATE.scene.add(points);
            return mat;
        }

        // Far tier: dense, tiny, dim, pale blue-white — the bulk of the
        // "significantly more stars" volume.
        const farMat = buildTier({
            count: isMobile ? 260 : 650,
            z: -24,
            zJitter: 6,
            sizeMin: 0.35,
            sizeMax: 0.9,
            opacityMin: 0.18,
            opacityMax: 0.55,
            color: 0x9fc0ff,
            twinkleAmount: 0.12,
            renderOrder: -30
        });

        // Near tier: sparser, larger, brighter — reads as the handful of
        // more prominent stars a real night-sky photo would show.
        const nearMat = buildTier({
            count: isMobile ? 60 : 170,
            z: -21,
            zJitter: 5,
            sizeMin: 1.0,
            sizeMax: 2.1,
            opacityMin: 0.45,
            opacityMax: 0.9,
            color: 0xe8f0ff,
            twinkleAmount: 0.22,
            renderOrder: -29
        });

        STATE.stars.materials = [farMat, nearMat];
    }

    function updateCameraFrustum() {
        const container = document.getElementById('sun-canvas');
        if (!container || !STATE.renderer || !STATE.camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;

        const viewHeight = 12;
        const viewWidth = viewHeight * aspect;

        STATE.camera.left = -viewWidth / 2;
        STATE.camera.right = viewWidth / 2;
        STATE.camera.top = viewHeight / 2;
        STATE.camera.bottom = -viewHeight / 2;

        STATE.camera.updateProjectionMatrix();

        // Same fix as three-scene.js — re-read devicePixelRatio on resize
        // so browser/page zoom doesn't leave the canvas rendering at a
        // stale, lower resolution.
        STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        STATE.renderer.setSize(width, height);
        
        updateSunPosition();
    }

    function onWindowResize() {
        updateCameraFrustum();
    }

    function onMouseMove(event) {
        if (!isDebugMode || sunStage >= 13) {
            STATE.targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
            STATE.targetMouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        }
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

        const isAnimated = (!isDebugMode || sunStage >= 12) && stageEnabled(12);
        const motionSpeed = (STATE.reducedMotion || !isAnimated) ? 0 : 1;

        // Star twinkle animates independently of the sun's stage-gated
        // motionSpeed above (that gating is tied to an unrelated
        // progressive-build debug mechanism) — only reduced-motion
        // preference should stop it.
        if (!STATE.reducedMotion) {
            STATE.stars.time += 0.35;
            STATE.stars.materials.forEach((mat) => {
                mat.uniforms.uTime.value = STATE.stars.time;
            });
        }

        if (isAnimated) {
            STATE.time += 0.005 * motionSpeed;
        }

        // Stage 12: Animations
        if (isAnimated) {
            // Very slow sphere rotation
            if (STATE.sun) {
                STATE.sun.rotation.y += 0.0001 * motionSpeed;
            }
        }

        // Stage 13: Responsive behavior / Mouse Parallax
        if (stageEnabled(13)) {
            if (isAnimated) {
                STATE.mouseX += (STATE.targetMouseX - STATE.mouseX) * 0.02; // Very slow reaction
                STATE.mouseY += (STATE.targetMouseY - STATE.mouseY) * 0.02;
            } else {
                STATE.mouseX = 0;
                STATE.mouseY = 0;
            }

            const viewWidth = STATE.camera.right * 2;
            const viewHeight = STATE.camera.top * 2;
            
            let px = -viewWidth * 0.14, py = viewHeight * 0.18;
            const w = window.innerWidth;
            if (w < 768) { px = -viewWidth * 0.11; py = viewHeight * 0.26; }
            else if (w < 992) { px = -viewWidth * 0.13; py = viewHeight * 0.2; }
            else { px = -viewWidth * 0.14; py = viewHeight * 0.18; }

            STATE.sunGroup.position.x = px + (STATE.mouseX * -0.3);
            STATE.sunGroup.position.y = py + (STATE.mouseY * 0.3);

            if (STATE.ambientGroup) {
                STATE.ambientGroup.position.x = (px + 12) + (STATE.mouseX * -0.1);
                STATE.ambientGroup.position.y = (py - 4) + (STATE.mouseY * 0.1);
            }
        } else if (STATE.sunGroup) {
            STATE.mouseX = 0; STATE.mouseY = 0;
            updateSunPosition();
        }

        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
        }
    }

    // Initialize when DOM is ready
    window.addEventListener('DOMContentLoaded', init);

})();