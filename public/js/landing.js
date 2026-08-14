(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        setupNavigationDrawer();
        setupHeaderScroll();
        setupSmoothScroll();
        setupStatsCounters();
        setupBackToTop();
        setupRevealAnimations();
        setupUpdateCardToggles();
    });

    // 1. Navigation Drawer (ESA inspired)
    function setupNavigationDrawer() {
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const navDrawer = document.getElementById('nav-drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const closeDrawerBtn = document.getElementById('close-drawer-btn');

        if (!hamburgerBtn || !navDrawer || !drawerOverlay) return;

        // Accessible Focus Trapping elements
        const focusableElementsSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        function openDrawer() {
            navDrawer.classList.add('open');
            drawerOverlay.classList.add('visible');
            hamburgerBtn.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden'; // Disable background scrolling

            // Trap focus: focus on the close button or first link
            setTimeout(() => {
                if (closeDrawerBtn) closeDrawerBtn.focus();
            }, 100);

            document.addEventListener('keydown', handleKeyDown);
        }

        function closeDrawer() {
            navDrawer.classList.remove('open');
            drawerOverlay.classList.remove('visible');
            hamburgerBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = ''; // Enable background scrolling

            // Return focus to hamburger
            hamburgerBtn.focus();

            document.removeEventListener('keydown', handleKeyDown);
        }

        function handleKeyDown(e) {
            // Escape key closes drawer
            if (e.key === 'Escape') {
                closeDrawer();
                return;
            }

            // Tab key traps focus
            if (e.key === 'Tab') {
                const focusableElements = navDrawer.querySelectorAll(focusableElementsSelector);
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        }

        hamburgerBtn.addEventListener('click', openDrawer);
        if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
        drawerOverlay.addEventListener('click', closeDrawer);

        // Drawer link interaction
        const drawerLinks = navDrawer.querySelectorAll('a');
        drawerLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    closeDrawer();
                }
            });
        });
    }

    // 2. Header State on Scroll
    function setupHeaderScroll() {
        const header = document.querySelector('.site-header');
        if (!header) return;

        const checkScroll = () => {
            if (window.scrollY > 40) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };

        window.addEventListener('scroll', checkScroll);
        checkScroll(); // Init status
    }

    // 3. Smooth Anchor Navigation & Active Section Highlighter
    function setupSmoothScroll() {
        // Smooth scroll adjustment for fixed header
        const header = document.querySelector('.site-header');
        const headerHeight = header ? header.offsetHeight : 70;

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    const targetPosition = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Highlight active navigation section on scroll
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.desktop-nav a');

        const activeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, {
            rootMargin: `-${headerHeight + 20}px 0px -60% 0px`
        });

        sections.forEach(sec => activeObserver.observe(sec));
    }

    // 4. Statistics Strip Count-Up Animation (Run once on viewport entry)
    function setupStatsCounters() {
        const statsSection = document.getElementById('stats-strip');
        if (!statsSection) return;

        const counters = statsSection.querySelectorAll('.stat-number');
        if (!counters.length) return;

        const runCounter = (el) => {
            const targetText = el.getAttribute('data-target');
            const hasPlus = targetText.includes('+');
            const hasSlash = targetText.includes('/');
            const numericValue = parseInt(targetText.replace(/[^0-9]/g, ''), 10);

            if (isNaN(numericValue)) {
                el.textContent = targetText;
                return;
            }

            const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (isReducedMotion) {
                el.textContent = targetText;
                return;
            }

            let start = 0;
            const duration = 2000; // 2 seconds
            const startTime = performance.now();

            const updateCount = (timestamp) => {
                const progress = Math.min((timestamp - startTime) / duration, 1);
                // Ease out quad
                const easeProgress = progress * (2 - progress);
                const current = Math.floor(easeProgress * numericValue);

                if (hasSlash) {
                    el.textContent = `${current}/7`;
                } else if (hasPlus) {
                    el.textContent = `${current}+`;
                } else {
                    el.textContent = current;
                }

                if (progress < 1) {
                    requestAnimationFrame(updateCount);
                } else {
                    el.textContent = targetText; // Ensure precise final state
                }
            };

            requestAnimationFrame(updateCount);
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    counters.forEach(runCounter);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.25 });

        observer.observe(statsSection);
    }

    // 5. Back-to-Top Control
    function setupBackToTop() {
        const backToTopBtn = document.getElementById('back-to-top');
        if (!backToTopBtn) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 6. IntersectionObserver Scroll Reveal Animations
    function setupRevealAnimations() {
        const revealElements = document.querySelectorAll('.info-card, .update-card, .access-card');
        const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isReducedMotion) {
            revealElements.forEach(el => el.style.opacity = '1');
            return;
        }

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => {
            el.classList.add('reveal-on-scroll');
            revealObserver.observe(el);
        });
    }

    // 7. Latest Updates — expand-in-place details instead of navigating away.
    // Scoped per-card via DOM structure (not id lookup) so each button can
    // only ever toggle its own card's panel, regardless of anything else on
    // the page.
    function setupUpdateCardToggles() {
        const cards = document.querySelectorAll('.update-card');

        cards.forEach((card) => {
            const btn = card.querySelector('.btn-read-more');
            const detail = card.querySelector('.update-detail');
            if (!btn || !detail) return;

            btn.addEventListener('click', () => {
                const isOpen = btn.classList.toggle('open');
                detail.classList.toggle('open', isOpen);
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });
    }

})();