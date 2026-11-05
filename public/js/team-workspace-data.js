// ============================================================================
// Data for team-workspace.html.
// Follows the same shape/conventions as new-to-ssa-data.js: content lives
// here, rendering logic lives in team-workspace-render.js. isPlaceholder
// marks items with no real resource behind them yet — the UI shows a
// "Sample" badge and no link for those, exactly like new-to-ssa.
// ============================================================================

// 01 — Conference Presentations. All 3 are real, verified ARIES talks —
// migrated from demonstration.html's old Presentations tab. Each links to
// its actual source page.
const TEAM_CONFERENCES = [
    {
        title: 'ExCoDOT-2025: Science Results from the 3.6-m Devasthal Optical Telescope',
        meta: 'Oct 2025',
        url: 'https://www.aries.res.in/excodot-2025',
        isPlaceholder: false
    },
    {
        title: '14th Aditya-L1 Support Cell Workshop',
        meta: '2026',
        url: 'https://www.aries.res.in/node/2272',
        isPlaceholder: false
    },
    {
        title: 'AI-Assisted Analysis of a Century of Kodaikanal Solar Observatory Imagery',
        meta: '2026',
        url: 'https://www.aries.res.in/node/2275',
        isPlaceholder: false
    }
];

// 02 — Technical PPTs. All 4 are real, saved under public/assets/Documents/.
const TEAM_PPTS = [
    {
        title: 'FPGA-Based Controller Design for CMOS Camera Sensors',
        meta: 'Jatin Ghai \u00b7 ARIES SSA Team \u00b7 12 slides',
        fileUrl: '/assets/Documents/FPGA_based_controller_design_forCMos.pptx',
        isPlaceholder: false
    },
    {
        title: 'Optical SSA Correlation Pipeline',
        meta: 'ARIES SSA Team \u00b7 11 slides',
        fileUrl: '/assets/Documents/optical-ssa-correlation-pipeline.pptx',
        isPlaceholder: false
    },
    {
        title: 'CCD Calibration & Photometric Techniques',
        meta: 'ARIES SSA Team \u00b7 14 slides',
        fileUrl: '/assets/Documents/ccd-calibration-photometry.pptx',
        isPlaceholder: false
    },
    {
        title: 'Satellite Trajectory Determination',
        meta: 'ARIES SSA Team \u00b7 38 slides',
        fileUrl: '/assets/Documents/satellite-trajectory-determination.pptx',
        isPlaceholder: false
    }
];

// 03 — Upcoming Meetings. All placeholder — no real schedule yet.
const TEAM_MEETINGS = [
    {
        title: 'Weekly SSA Sync',
        meta: 'Every Monday \u00b7 10:00 AM \u00b7 Placeholder schedule',
        isPlaceholder: true
    },
    {
        title: 'Optical Tracking Pipeline Review',
        meta: 'Date TBD \u00b7 Placeholder',
        isPlaceholder: true
    },
    {
        title: 'Quarterly SSA Roadmap Planning',
        meta: 'Date TBD \u00b7 Placeholder',
        isPlaceholder: true
    }
];

// 04 — Brainstorming Sessions. Rendered as expandable cards (like
// SSA_TERMS on new-to-ssa.html) — title + a short summary of what was/will
// be discussed. All placeholder for now.
const TEAM_BRAINSTORM_SESSIONS = [
    {
        term: 'Conjunction Screening Automation',
        definition: 'Placeholder — notes on automating close-approach screening will go here once this session happens.'
    },
    {
        term: 'Data Fusion Across Sensors',
        definition: 'Placeholder — ideas for combining optical, radar, and other sensor inputs into a single tracking pipeline.'
    },
    {
        term: 'Public Data Access Policy',
        definition: 'Placeholder — discussion notes on what portal data can be opened up externally, and to whom.'
    }
];