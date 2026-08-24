/**
 * TEAM MEMBER DATA
 * ------------------------------------------------------------------
 * This is the ONLY file you need to edit to update the team page.
 * Both team.html (cards + expand panel) and member.html (full profile)
 * read from this file.
 *
 * IMPORTANT — this file was previously overwritten with team.js's code
 * by accident, which is why the page went blank (TEAM_MEMBERS, PROJECTS,
 * CATEGORY_META, COLUMN_GROUPS all stopped existing). This is a clean
 * rebuild — make sure whatever you paste back into this file in future
 * always starts with "const TEAM_MEMBERS = [...]", never "(function(){...".
 *
 * ------------------------------------------------------------------
 * STAGED ROLLOUT — the "published" field
 * ------------------------------------------------------------------
 * Every member has a `published` flag. team.js and member.js only ever
 * show entries where `published: true`. This is what lets people fill in
 * their own info at their own pace without the whole roster (or a half-
 * finished profile) going live at once — you (or they, via a PR) can add
 * or edit an object here any time, and it stays invisible on the site
 * until that one person's `published` is flipped to true.
 * See the note at the bottom of this file for the recommended workflow
 * for letting individual members submit their own edits.
 *
 * ------------------------------------------------------------------
 * PROJECT LEAD — separate from TEAM_MEMBERS on purpose
 * ------------------------------------------------------------------
 * T. S. Kumar (Scientist-F) leads the SSA project. His profile carries a
 * lot more structure than a regular roster entry (education, a real
 * professional-experience timeline with sub-points, funded projects,
 * an "open to interns" note) so it gets its own PROJECT_LEAD object and
 * its own spotlight section on team.html (see renderLeadership() in
 * team.js), rather than being squeezed into the TEAM_MEMBERS card shape.
 * Set PROJECT_LEAD to null to hide the spotlight section entirely.
 *
 * PROJECT_LEAD fields:
 *   name          - full name
 *   designation   - formal title, e.g. "Scientist-F"
 *   role          - their role on this project, shown as a badge
 *   organization  - institution name
 *   researchAreas - array of short strings, shown as tags under the name
 *   photo         - path to a photo, or null to show initials avatar
 *   email         - short id, rendered as [id]@aries.res.in
 *   phone         - extension number, or null
 *   education     - free text
 *   experience    - array of { role, org, period, points: [strings] },
 *                   most recent first — rendered as a timeline
 *   interests     - array of strings, rendered as a bullet list
 *   projects      - array of strings, rendered as a bullet list
 *   openTo        - { note: string, points: [strings] } — the "interested
 *                   interns/researchers" call-out, or null to omit it
 *   links         - { website, scholar, github, linkedin } — omit or set
 *                   null for any not used
 * ------------------------------------------------------------------
 *
 * TEAM_MEMBERS fields:
 *   id                 - unique url-safe slug, used as ?id= in member.html links
 *   name               - full name
 *   designation        - job title / role, shown under the name
 *   category           - which specific discipline this person belongs to. Drives
 *                        the small badge on their card (see CATEGORY_META below).
 *                        Which COLUMN they appear in is decided separately by
 *                        COLUMN_GROUPS further down — multiple categories can
 *                        share one column.
 *   organization       - which partner org's project they contribute to, e.g.
 *                        "ISRO" | "DRDO" | "BEL". Shown on the card. Set to null
 *                        if not tied to a specific partner org.
 *   field              - free text, e.g. "Embedded Systems".
 *   workingOn          - free text describing current work, shown as
 *                        "Working on: ..." on the card and expand panel.
 *   researchArea       - free text, e.g. "Optical Remote Sensing" — shown on
 *                        the full profile page next to designation.
 *   photo              - path to a photo, or null to show initials avatar
 *   email              - short id, will be rendered as [id]@aries.res.in
 *   phone              - extension number, or null
 *   bio                - 1-3 short paragraphs as an array of strings (empty [] is fine)
 *   interests          - array of research interest strings, shown as small tags
 *   researchExperience - array of strings, one per position/timeline entry,
 *                        e.g. "2022–Present: Project Scientist, ARIES SSA
 *                        Programme". Shown as a timeline list on the profile page.
 *   publications       - array of { citation, url }. `url` is optional (set to
 *                        null if there isn't a DOI/link for that entry) — shown
 *                        as a numbered list on the profile page.
 *   links              - { website, scholar, github, linkedin } — omit or set null
 *                        for any not used. "website" is their personal webpage,
 *                        maintained by the individual themself.
 *   published          - true to show this person on the live site, false to
 *                        keep them hidden while they're still filling in info.
 *
 * To add a real person: duplicate a placeholder object under the right
 * category, give it a unique id, fill in the fields, then set
 * published: true when they're ready to go live.
 */

const PROJECT_LEAD = {
     id: "ece-09",
    name: "T. S. Kumar",
    designation: "Scientist-F",
    role: "Project Lead — Space Situational Awareness (SSA) Programme",
    organization: "ARIES, Nainital",
    researchAreas: [
        "Precision Control Systems for Astronomical Telescopes and Instrumentation",
        "Scientific Imaging Systems (CCD/CMOS) Development",
        "Space Situational Awareness (SSA)",
        "Embedded Systems",
        "Adaptive Optics"
    ],
    photo:"/assets/team/ece-09.png",
    email: "kumar",
    phone: "783",
    education: "Ph.D., Systems and Control Engineering, IIT Bombay, Mumbai, India",
    experience: [
        {
            role: "Scientist/Engineer",
            org: "ARIES, Nainital, India",
            period: "2004–Present",
            points: [
                "Designed and developed precision control systems for optical telescopes, enabling accurate tracking and pointing",
                "Developed and integrated CCD/CMOS-based astronomical instruments and backend systems",
                "Led system integration, testing, and commissioning of telescope subsystems",
                "Leading Space Situational Awareness (SSA) initiatives, focusing on optical tracking systems, instrumentation, and data processing"
            ]
        },
        {
            role: "Engineer",
            org: "Tata Motors, Pune, India",
            period: "2002–2004",
            points: [
                "Developed and tested automobile aggregate control units, including design and implementation of test rigs and validation setups",
                "Led maintenance and automation improvements for the Tata Safari robotic production line, including logic debugging, interlock optimization, and enhancements to transfer lines (conveyor–gantry, hemming press) and robotic systems using servo control"
            ]
        }
    ],
    interests: [
        "Design and engineering of advanced ground-based optical telescopes",
        "System engineering and integration of astronomical instrumentation",
        "Development of backend instruments including polarimeters, spectrographs, and CCD/CMOS imaging systems",
        "Adaptive optics systems and deformable mirror control for high-resolution imaging",
        "High-precision motion control systems for telescope tracking and positioning",
        "Space Situational Awareness (SSA) and optical tracking systems",
        "Embedded and real-time control systems for scientific applications",
        "Hardware-in-the-loop (HIL) simulation and system validation",
        "Human–Machine Interface (HMI) and supervisory control systems",
        "Scientific software, control systems, and automation frameworks"
    ],
    projects: [
        "ISRO-RESPOND Programme: Development of FPGA-based CMOS controller for real-time autonomous space object tracking using ground-based telescopes",
        "SSA software development, BEL Ghaziabad",
        "Evaluation of ground-based optical telescopes for SSA, IRDE-DRDO",
        "Development of wide-field telescope for SSA, ISTRAC-ISRO"
    ],
    openTo: {
        note: "Interested interns, researchers, and engineering graduates may contact him to work on ongoing projects related to telescope systems, SSA, and instrumentation development.",
        points: [
            "Control systems and precision motion control",
            "FPGA-based system design and high-speed data acquisition",
            "Optical instrumentation and adaptive optics",
            "Space Situational Awareness (SSA) and tracking algorithms",
            "Artificial intelligence and machine learning for event detection, object classification, and SSA data analysis",
            "Embedded systems and real-time software"
        ]
    },
    links: { website: null, scholar: null, github: null, linkedin: null }
};

const TEAM_MEMBERS = [
    // ---- Software Engineers (3) — networking work is not a separate
    // category anymore, it's just folded into this column ----
    { id: "swe-01", name: "Vaagiesha Sharma", designation: "Software Engineer", category: "software_engineer", organization: "DRDO-IRDE", field: "Software Development (AI/ML & Computer Vision)", workingOn: "Making AI & ML based pipelines for Object detection", researchArea: "Space Situational Awareness, AI/ML Detection Pipelines", photo: "/assets/team/swe-01.jpg", email: "vaageishasharma@gmail.com", bio: [
  "Working on Space Situational Awareness (SSA) at ARIES under a DRDO-IRDE project, focusing on AI/ML-based detection pipelines.",
  "Experienced in real-time object detection and simulation frameworks for astronomical image data."], interests: ["Computational Astronomy & Space Situational Awareness"], publications: [
  {
    citation: "Development of a Wide Field 60 cm Optical Telescope for Space Situational Awareness: Simulation and Validation Using the 1.3 m DFOT (second author)",
    url: null
  },
  {
    citation: "Integrated Thermodynamic and Vibration Analysis of Micro Turbines for Aerospace Applications Using MATLAB — VETOMAC, IIT Guwahati (In Process)",
    url: null
  },
  {
    citation: "Shock Wave Attenuation Using Architected Geometric Structures: A CEL-Based Numerical Investigation — ICAMAS, NIT Arunachal Pradesh (In Process)",
    url: null
  },
  {
    citation: "Collision-Avoidance Optimisation for Low-Earth-Orbit Satellite Constellations Using Multi-Objective Operations Planning — SMOPs Conference, ISRO (Presentation)",
    url: null
  },
  {
    citation: "Digital Twin-Enabled RL-Controlled Active Flow Conditioning in a Subsonic Wind Tunnel Using Synthetic Sensor Feedback — NCWT-07 Conference, BIT Mesra (Presentation)",
    url: null
  }
], links: { website: null, scholar: null, github: null, linkedin: null }, published: true },
    { id: "swe-02", name: "Pallavi Sati", designation: "Software Engineer", category: "software_engineer", organization: "DRDO-IRDE", field: "Astrophysics and Machine Learning", workingOn: "Alert Broker Architecture for SSA", researchArea: "Resident space object (RSO) detection and space situational awareness via data-archive and alert-broker systems, alongside LSST/Rubin-era machine-learning reliability, calibration of transient classifiers and learning-to-defer for follow-up prioritization.", photo:"/assets/team/swe-02.jpg", email: "pallavisati23@gmail.com", bio: ["Astrophysicist (MSc, Data-Intensive Astrophysics, Cardiff) working across time-domain astronomy and machine learning. At ARIES, the work comprises RSO detection and space situational awareness; personal research on the reliability of ML transient classifiers for LSST-era surveys was presented at NAM 2026 Birmingham and is in preparation for an Astronomical Journal."], interests: ["Time-domain astrophysics, machine-learning reliability, classifier calibration, LSST alert brokers, and space situational awareness (RSO detection)."], publications: ["Calibration and Reliability of ZTF Transient Broker Classifiers — poster, National Astronomy Meeting (NAM) 2026; manuscript in preparation for an Astronomical Journal."], links: { website: null, scholar: null, github: null, linkedin: "https://www.linkedin.com/in/pallavi-sati-910761213/ "}, published: true },
    { id: "swe-03", name: "Aadhya Shrivastava", designation: "Software Engineer", category: "software_engineer", organization: "BEL", field: "Software Engineering", workingOn: "Website/Software development, Pipeline automation for Satellite image processing", researchArea: "AI Applications, Data processing, Satellite data analysis", photo:"/assets/team/swe-03.jpg", email: "aadhyashriv22@gmail.com", bio: ["A Computer Science and Communication Engineering graduate working as a Project Associate at ARIES. My work focuses on automating the image processing pipeline, data analysis, and software development for space situational awareness using AI. I am particularly interested in bridging computer science with space research, contributing to real-world scientific and observational challenges."], interests: ["Remote sensing, satellite data analysis, AI in space science, data analytics"], 
    publications: [ {
            title: "IoT-Enabled Real-Time Fire Monitoring and Response in Urban Areas",
            journal: "ISTI",
            
        },
        {
            title: "Stacking Ensemble Regression for Surrogate Modeling of Terahertz Microstrip Patch Antennas",
            journal: "Turkish Journal of Electrical Engineering & Computer Sciences",
            
        },
        {
            title: "Design and Optimization of a Ku-Band Microstrip Patch Antenna for Satellite Communications Using Machine Learning",
            journal: "ChemistrySelect (Wiley)",
            
        }], links: { website: null, scholar: null, github: null, linkedin:"https://www.linkedin.com/public-profile/settings/?lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_self_edit_contact_info%3BxbKG2Rz9SH%2Bx0pXiUcMiJw%3D%3D" }, published: true },

    // ---- Electronic Engineers (3) ----
    { id: "ece-01", name: "Bhargavi BN", designation: "Electronics Engineer", category: "electronic_engineer", organization: "ISTRAC-ISRO", field: "Electronics and Communication engineer", workingOn: " Embedded sytstem for Schmidt telescope Control ", researchArea: "Embedded system ", photo:"/assets/team/ece-01.jpg", email: "bnbhargavi312gmail.com", bio: ["Electronics and Communication Engineer working as Project Associate I at ARIES–ISTRAC ISRO. Working on Schmidt Telescope control systems, embedded electronics, servo motor control, encoder interfacing, and hardware integration for astronomical instrumentation."], interests: ["Embedded system ,IoT,control sytstem"], researchExperience: ["Implementation of Underground Mining Robot Using Machine Learning.."], publications: [], links: { website: null, scholar: null, github: null, linkedin: "https://www.linkedin.com/in/bn-bhargavi-463257301?utm_source=share_via&utm_content=profile&utm_medium=member_android" }, published: true },
    { id: "ece-02", name: "Jatin Ghai", designation: "Electronics Engineer", category: "electronic_engineer", organization: "ISRO RESPOND PROJECT", field: "Electronics and Communication engineer", workingOn: "FPGAs and CMOS based camera sensors", researchArea: "FPGA based real time controller design for CMOS imaging", photo: "/assets/team/ece-02.jpg", email: "jatinghai539@gmail.com", bio: ["I am currently working on FPGA-based CMOS camera interfacing and image processing. My work involves receiving camera data through the Zynq FPGA, handling timing and control signals, storing image frames, and developing real-time image-processing functions."], interests: ["FPGAs,VLSI,Embedded system "], publications: [], links: { website: null, scholar: null, github: null, linkedin:"https://www.linkedin.com/in/jatin-ghai-b9a1a21b6?utm_source=share_via&utm_content=profile&utm_medium=member_android" }, published: true },


    // ---- Physicists — one column, 3 different kinds of physicist ----
    // "space_physicist" is a placeholder label for the 3rd kind — rename
    // the category name/tag below (and here) to whatever the real
    // specialization is called.
    { id: "opt-01", name: "Aneena A", designation: "Optical Physicist", category: "optical_physicist", organization: "BEL", field: "Optics", workingOn: "Optic design, simulation and optimisation using Zemax optics studio", researchArea: "Telescope Optics", photo: "/assets/team/opt-01.jpg", email: "a.aneena2000@gmail.com", bio: ["I am an M.Sc. Physics graduate currently working as a Project Associate at ARIES. My work focuses on the design, simulation, optimization, and analysis of telescopic optical systems using Zemax OpticStudio, with an emphasis on minimizing optical aberrations."], interests: ["Telescope Optics and Detectors"], publications: [], links: { website: null, scholar: null, github: null, linkedin: null }, published: true },
    { id: "sph-01", name: "Rithu Arjun", designation: "Astrophysicist", category: "space_physicist", organization: "ISTRAC-ISRO", field: "Astrophysics", workingOn: "Developement of an Automated Photomerty pipeline, Softeware development for Schmidt Telescope contro system, Hardware-Software integration through Raspberry-pi.", researchArea: "Astronomical instrumentation, photometric data reduction and calibration, telescope control software, and observatory automation for optical astronomical observations.", photo:"/assets/team/sph-01.jpeg", email: "rithuarjun64@gmail.com", bio: ["I am currently working on the design and automation of astronomical telescope domes, where I enjoy bringing together hardware, software, and engineering to support observatory operations. My work involves system integration, testing, troubleshooting, and documentation, giving me the opportunity to learn something new every day while solving real-world challenges. I'm fascinated by how technology enables astronomical observations and enjoy finding practical solutions that improve the reliability and efficiency of observatory systems. I especially enjoy working at the intersection of instrumentation, software, and automation, where every challenge is an opportunity to better understand how complex systems come together."], interests: [], researchExperience: [], publications: [], links: { website: null, scholar: null, github: null, linkedin: null }, published: true },
    
    // ---- Junior & Postgraduate Engineers — merged into one column ----
    { id: "jr-01", name: "Ashwin Muarya", designation: "Junior Engineer", category: "junior_engineer", organization: "BEL/ISTRAC", field: "Electronics engineering", workingOn: "Dome Automation Design", researchArea: "Dome Automation Design", photo: "/assets/team/jr-01.jpg", email: "ashvin0563@gmail.com", bio: ["I am working on the Dome Automation Design project, focusing on the automation and control of astronomical telescope domes. My work includes studying and integrating hardware components such as PLCs, sensors, motors, limit switches, encoders, and communication systems to achieve accurate dome rotation and shutter control. I am also involved in system design, testing, troubleshooting, and documentation to ensure safe, reliable, and efficient operation of the observatory dome."], interests: ["Satellit Tracking substaion"], publications: [], links: { website: null, scholar: null, github: null, linkedin: "https://www.linkedin.com/in/ashvin-maury-3b0302387"}, published: true },
    { id: "pg-01", name: "Suchandra Ray", designation: "Postgraduate Engineer", category: "postgraduate_engineer", organization:"ARIES" , field: "Astronomical Instrumentation", workingOn: "Methodologies for the optical tracking of high-speed RSOs(Resident Space Objects)", researchArea: "High-cadence imaging techniques", photo: null, email: "suchandra@aries.res.in", bio: ["Current work involves the high-cadence imaging apllications in the field of SSA and astronomy"], interests: ["Orbital mechanics, Satistical state estimation, Telescope operations, Fourier optics, Optical degisn"], publications: [], links: { website: null, scholar: null, github: null, linkedin: null }, published: true },
    { id: "pg-02", name: "Mahendra Shah", designation: "Postgraduate Engineer", category: "postgraduate_engineer", organization: "ARIES", field: "Astronomical Instrumentation", workingOn: "Charaterization of Detectors (EMCCD & sCMOS)", researchArea: "Adaptive Optics", photo: null, email: "mahendershah2@gmail.com", bio: ["In-house design and development of AO"], publications: [], links: { website: null, scholar: null, github: null, linkedin: "http://www.linkedin.com/in/mahender-shah-99a1b0180" }, published: true },

    // ---- Aerospace Engineer — its own column ----
    { id: "aero-01", name: "Divanshu Chaubey", designation: "Aerospace Engineer", organization: "BEL", category: "aerospace_engineer", field: "Mechanical designing", workingOn: "Design, development, fabrication, and assembly of precision components for telescope systems, scientific sensors, observatory domes, telescope mounts, and mechatronic subsystems, including development and characterisation of flexure and thermal models.", researchArea: "Development of astronomical instrumentation and telescope mechanisms, precision mechanical design, experimental aerodynamics, gas dynamics, shock-wave interactions, shock-tube studies, numerical simulations, and wind-tunnel experiments.", photo: "/assets/team/aero-01.jpg", email: "divyanshu.aries@gmail.com", bio: ["An Aerospace Engineer working in telescope systems and precision mechanical design, with experience spanning aerospace research, propulsion, experimental testing, and product development."], interests: ["Development of astronomical instrumentation and telescope mechanisms, precision mechanical design, experimental aerodynamics, gas dynamics, shock-wave interactions, shock-tube studies, numerical simulations, and wind-tunnel experiments."], researchExperience: ["Research experience in telescope systems, experimental aerodynamics, gas dynamics, and shock-wave interactions. His work spans wind-tunnel experiments, shock-tube studies, numerical simulations, precision mechanical design, and the development of astronomical instrumentation and telescope mechanisms."], publications: [ {
    citation: "Integrated Thermodynamic and Vibration Analysis of Micro Turbines for Aerospace Applications Using MATLAB — VETOMAC, IIT Guwahati (In Process)",
    url: null
  },
  {
    citation: "Shock Wave Attenuation Using Architected Geometric Structures: A CEL-Based Numerical Investigation — ICAMAS, NIT Arunachal Pradesh (In Process)",
    url: null
  },
  {
    citation: "Collision-Avoidance Optimisation for Low-Earth-Orbit Satellite Constellations Using Multi-Objective Operations Planning — SMOPs Conference, ISRO (Presentation)",
    url: null
  },
  {
    citation: "Digital Twin-Enabled RL-Controlled Active Flow Conditioning in a Subsonic Wind Tunnel Using Synthetic Sensor Feedback — NCWT-07 Conference, BIT Mesra (Presentation)",
    url: null
  }], links: { website: null, scholar: null, github: null, linkedin:"www.linkedin.com/in/divyanshu-chaubey-287b18211" }, published: true },

    
  ];

// Per-person badge shown on their card (small tag, e.g. "SWE", "OPT").
// This does NOT decide which column someone appears in — see
// COLUMN_GROUPS below for that.
const CATEGORY_META = {
    software_engineer:     { tag: "SWE" },
    electronic_engineer:   { tag: "ECE" },
    optical_physicist:     { tag: "OPT" },
    astrophysicist:        { tag: "AST" },
    space_physicist:       { tag: "SPH" },   // rename if this isn't the real term
    junior_engineer:       { tag: "JR" },
    postgraduate_engineer: { tag: "PG" },
    aerospace_engineer:    { tag: "AERO" },
    
};

// Column layout for the team page. Order here = column order on the page.
// "categories" lists every category key that should appear inside that
// column — list more than one to merge categories into a shared column
// (each person still shows their own individual badge from CATEGORY_META).
const COLUMN_GROUPS = [
    { title: "Software Engineers", categories: ["software_engineer"] },
    { title: "Electronic Engineers", categories: ["electronic_engineer"] },
    { title: "Physicists", categories: ["optical_physicist", "astrophysicist", "space_physicist"] },
    { title: "Junior & Postgraduate Engineers", categories: ["junior_engineer", "postgraduate_engineer"] },
    { title: "Aerospace Engineers", categories: ["aerospace_engineer"] },
    
];

// ------------------------------------------------------------------
// CURRENT PROJECTS
// Powers the "Current Projects" section on the team page.
// Based on ARIES's real, publicly-announced MoUs: ISRO (signed 4 June
// 2020), DRDO/IRDE Dehradun (signed 13 May 2025), and BEL (signed
// September 2024, at BEL's Ghaziabad unit). Sources: Press Information
// Bureau / DST press release, Tribune India, PSU Watch, IBC World News.
// Descriptions below are paraphrased summaries of the publicly reported
// scope of each MoU, not verbatim text from any source.
// ------------------------------------------------------------------
const PROJECTS = [
    {
        id: "proj-01",
        title: "ISRO–ARIES SSA & Astrophysics Collaboration",
        description: "Signed June 2020, establishing ground-based optical telescope facilities for space object tracking, alongside joint studies on space weather, astrophysics, and near-Earth objects — supporting protection of Indian space assets from debris conjunction risks.",
        orgs: ["ISRO"],
        status: "Ongoing"
    },
    {
        id: "proj-02",
        title: "DRDO–IRDE Ground-Based SSA Partnership",
        description: "MoU with DRDO's Instruments Research & Development Establishment (Dehradun), signed May 2025, focused on monitoring space objects, developing electro-optical systems for astronomy and SSA, and AI/ML-based image processing — using ARIES's 3.6-m Devasthal Optical Telescope and ST Radar.",
        orgs: ["DRDO"],
        status: "Ongoing"
    },
    {
        id: "proj-03",
        title: "BEL SSA Technology Development",
        description: "MoU with Bharat Electronics Limited, signed September 2024, developing technologies for tracking near-Earth objects and artificial satellites in support of India's Space Situational Awareness efforts — utilizing ARIES's 4-m International Liquid Mirror Telescope.",
        orgs: ["BEL"],
        status: "Ongoing"
    }
];

/**
 * ------------------------------------------------------------------
 * HOW TO LET EACH PERSON FILL IN THEIR OWN INFO — WITHOUT PUBLISHING
 * EVERYONE AT ONCE
 * ------------------------------------------------------------------
 * This file is just static data, so there's no built-in "who can edit
 * what" boundary — anyone editing it can see/change every entry. Two
 * practical ways to get individual, staged submissions out of that:
 *
 * 1. Git branch/PR per person (recommended if you're already using git):
 *    Each member edits ONLY their own object in this file on their own
 *    branch and opens a PR. You review just that diff (git makes it
 *    obvious if they touched anyone else's entry) and merge it with
 *    `published: true` still set. Nothing changes on the live site
 *    until you flip their `published` to true yourself, whenever
 *    they're happy with it. This is the cleanest option and needs no
 *    extra infrastructure beyond git.
 *
 * 2. A personal Google Form per person, if some members aren't
 *    comfortable with git:
 *    Give each person a form scoped to their own fields (name,
 *    designation, bio, links, etc.), collected into a spreadsheet with
 *    one row per person. You (or a small script) copy a finished row
 *    into their object here and set published: true. Their draft lives
 *    in the spreadsheet, invisible to the public, until you do that.
 *
 * Either way, the `published` flag is what actually keeps a half-done
 * profile off the live site — it's safe to merge/save someone's data
 * here at any time as long as `published` stays false.
 */