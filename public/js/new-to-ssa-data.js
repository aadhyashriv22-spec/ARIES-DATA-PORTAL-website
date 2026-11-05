// ============================================================================
// Data for new-to-ssa.html.
// ============================================================================

// 02 — Understanding SSA. Exactly the 6 terms specified.
const SSA_TERMS = [
    { term: 'Satellite', definition: 'A human-made object placed in orbit around Earth for communication, observation, navigation, or research.' },
    { term: 'Orbit', definition: 'The curved path an object follows around a larger body due to gravity.' },
    { term: 'Space Debris', definition: 'Defunct satellites, spent rocket stages, and fragments that remain in orbit without any function.' },
    { term: 'TLE', definition: 'Two-Line Element set — a standardized format encoding a satellite\u2019s orbital elements.' },
    { term: 'Conjunction', definition: 'A close approach between two objects in orbit, assessed for collision risk.' },
    { term: 'Re-entry', definition: 'The event where an orbiting object descends into the atmosphere.' }
];

// 03 — Learn & Explore, grouped into 3 categories. No real files exist for
// any of these yet — isPlaceholder marks that clearly; the UI renders a
// disabled action instead of linking to something that doesn't exist.
const SSA_CATEGORIES = [
    {
        id: 'beginner-guides',
        title: 'Beginner Guides',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        items: [
            { title: 'Orbital Mechanics Fundamentals', meta: 'PDF \u00b7 12 min', isPlaceholder: true },
            { title: 'Optical Tracking Principles', meta: 'PDF \u00b7 16 min', isPlaceholder: true },
            { title: 'SSA Applications & Use Cases', meta: 'PDF \u00b7 15 min', isPlaceholder: true }
        ]
    },
    {
        id: 'reference-materials',
        title: 'Reference Materials',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        items: [
            { title: 'Data Acquisition & Reduction', meta: 'PDF \u00b7 18 min', isPlaceholder: true },
            { title: 'Orbit Determination & Prediction', meta: 'PDF \u00b7 20 min', isPlaceholder: true }
        ]
    },
    {
        id: 'recommended-reading',
        title: 'Recommended Reading',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        // Real, verifiable citations — complete commercially-published
        // academic books. Citation only, no hosted file (redistributing
        // full text would be copyright infringement).
        items: [
            { title: 'Handbook of CCD Astronomy', meta: 'Steve B. Howell \u00b7 Cambridge University Press, 2006', isPlaceholder: false },
            { title: 'The Design and Construction of Large Optical Telescopes', meta: 'Pierre-Yves Bely \u00b7 Springer, 2003', isPlaceholder: false }
        ]
    }
];

// 04 — The SSA Ecosystem. Real, verified ARIES partnerships.
const SSA_ORGS = [
    {
        id: 'isro', name: 'ISRO',
        detail: 'MoU signed 2020 \u2014 ground-based optical telescope facilities for space object tracking, plus joint studies on space weather, astrophysics, and near-Earth objects.'
    },
    {
        id: 'drdo', name: 'DRDO',
        detail: 'MoU with DRDO\u2019s Instruments Research & Development Establishment, signed 2025 \u2014 ground-based SSA, electro-optical systems, and AI/ML-based image processing.'
    },
    {
        id: 'bel', name: 'BEL',
        detail: 'MoU with Bharat Electronics Limited, signed 2024 \u2014 technologies for tracking near-Earth objects and artificial satellites.'
    }
];

const SSA_ECOSYSTEM_NOTE = 'Beyond ARIES\u2019s own collaborations, SSA is a global effort. Space agencies, research institutions, and commercial data providers around the world operate telescopes, radars, and tracking networks that together build a shared picture of the orbital environment.';