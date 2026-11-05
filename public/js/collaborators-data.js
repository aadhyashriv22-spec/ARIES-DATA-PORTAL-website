/**
 * ------------------------------------------------------------------
 * COLLABORATORS
 * Powers /collaborators.html (overview cards) and
 * /collaborator.html?id=<id> (one page per organization).
 *
 * Content is paraphrased from the official announcements of each MoU and
 * from ARIES's own project pages — see each entry's `sources`. Edit text
 * here; the pages pick it up automatically.
 *
 * Fields:
 *   id            - used in the URL: /collaborator.html?id=<id>
 *   name          - short display name
 *   fullName      - full organization name
 *   parent        - parent organization / ministry
 *   location      - city, state
 *   monogram      - 2–4 letters for the badge (no external logos used)
 *   teamOrgMatch  - strings matched against `organization` in team-data.js
 *                   to list the team members working on this project
 *   summary       - one-paragraph card text for the overview page
 *   about         - paragraphs describing the organization
 *   mou           - { signed, place, signatories[], facilities[], text[] }
 *   focusAreas    - bullet list: SSA scope of the collaboration
 *   workAtAries   - bullet list: work being carried out at ARIES
 *   sources       - [{ label, url }]
 * ------------------------------------------------------------------
 */
const COLLABORATORS = [
    {
        id: "istrac",
        name: "ISTRAC – ISRO",
        fullName: "ISRO Telemetry, Tracking and Command Network",
        parent: "Indian Space Research Organisation (ISRO)",
        location: "Bengaluru, Karnataka",
        monogram: "ISRO",
        teamOrgMatch: ["ISTRAC"],
        summary: "ARIES and ISRO cooperate on Space Situational Awareness and astrophysics under an MoU signed in June 2020. Under this partnership, the Baker-Nunn Schmidt Telescope at Manora Peak, Nainital is being refurbished as a dedicated optical facility for tracking satellites and space debris. The project feeds ISRO's SSA effort, which is run from the NETRA control centre at ISTRAC, Bengaluru.",
        about: [
            "ISTRAC, the ISRO Telemetry, Tracking and Command Network, provides tracking support for ISRO's satellite and launch vehicle missions from its headquarters in Bengaluru.",
            "Its Peenya campus hosts NETRA (NEtwork for space object TRacking and Analysis), ISRO's dedicated Space Situational Awareness control centre, inaugurated on 14 December 2020. NETRA is the hub of SSA activity in India. It processes observations of space objects for orbit determination and catalogue generation, analyses close approaches to Indian satellites and launch vehicles, issues advance collision-avoidance alerts, and forecasts the re-entry of defunct satellites and rocket bodies."
        ],
        mou: {
            signed: "4 June 2020",
            place: "By videoconference, between ISRO HQ and ARIES, Nainital",
            signatories: [
                "Shri R. Umamaheswaran, Scientific Secretary, ISRO",
                "Prof. Dipankar Banerjee, then Director, ARIES"
            ],
            facilities: [
                "Baker-Nunn Schmidt Telescope (BNST), Manora Peak, Nainital"
            ],
            text: [
                "The MoU covers cooperation in Space Situational Awareness and astrophysics. Tracking space objects, analysing their orbits and studying space weather are central to protecting Indian space assets from critical conjunctions with space debris. Self-reliance in these capabilities is a priority for India's space programme.",
                "An implementation agreement between ISRO and ARIES followed in January 2024 for the refurbishment and use of the BNST at Manora Peak for SSA. ARIES manages the work, which is reviewed jointly by ARIES and ISRO."
            ]
        },
        focusAreas: [
            "Establishing optical telescope facilities for tracking space objects",
            "Refurbishing the Baker-Nunn Schmidt Telescope as a wide-field SSA instrument",
            "Tracking satellites and orbital debris to support conjunction (collision) assessment",
            "Joint R&D in space weather, astrophysics and Near-Earth Objects (NEOs)"
        ],
        workAtAries: [
            "Design, development and validation of the telescope control system and its software",
            "Design, fabrication and assembly of components for the telescope, sensors and dome structures",
            "Development of the mount and mechatronic subsystems",
            "Flexure and thermal modelling of the telescope system",
            "Embedded electronics, servo motor control and encoder interfacing",
            "Night observations to track satellites and orbital debris"
        ],
        sources: [
            { label: "ISRO press release: MoU between ISRO and ARIES (June 2020)", url: "https://www.isro.gov.in/Release.html" },
            { label: "ISRO: SSA Control Centre (NETRA) at ISTRAC", url: "https://www.isro.gov.in/ISRO_EN/ISRO%20SSAControl%20Centre.html" },
            { label: "ARIES: SSA project funded by ISTRAC–ISRO", url: "https://www.aries.res.in/ProjectAssociate_btech_fundedby_ISTRAC_ISRO" }
        ]
    },
    {
        id: "irde",
        name: "IRDE – DRDO",
        fullName: "Instruments Research & Development Establishment",
        parent: "Defence Research and Development Organisation (DRDO)",
        location: "Dehradun, Uttarakhand",
        monogram: "IRDE",
        teamOrgMatch: ["IRDE"],
        summary: "ARIES, an autonomous institute of the Department of Science & Technology, signed an MoU with DRDO's IRDE in May 2025 to strengthen ground-based Space Situational Awareness. The partners use ARIES's observing facilities to monitor space objects and jointly develop electro-optical systems. They also build AI/ML-based techniques for processing SSA image data.",
        about: [
            "The Instruments Research & Development Establishment (IRDE), Dehradun, is a laboratory of the Defence Research and Development Organisation (DRDO) that develops electro-optical instruments and systems.",
            "IRDE is close to ARIES, Nainital, which makes regular interaction easy: both sides can share facilities, exchange technical expertise and coordinate joint activities."
        ],
        mou: {
            signed: "13 May 2025",
            place: "IRDE, Dehradun",
            signatories: [
                "Dr. Manish Kumar Naja, Director, ARIES",
                "Dr. Ajay Kumar, Director, IRDE"
            ],
            facilities: [
                "3.6 m Devasthal Optical Telescope",
                "ST Radar system"
            ],
            text: [
                "The MoU between DST's ARIES and DRDO's IRDE aims to strengthen India's ground-based Space Situational Awareness. It draws on ARIES's national observing facilities, including the 3.6 m Devasthal Optical Telescope, among the largest optical telescopes in India, and the ST Radar."
            ]
        },
        focusAreas: [
            "Using ARIES observing facilities to monitor and acquire data on space objects",
            "Jointly developing electro-optics based systems for astronomy and SSA",
            "Developing image-processing and data-analysis techniques that integrate AI/ML",
            "Knowledge exchange, training and capacity building through joint R&D"
        ],
        workAtAries: [
            "Night-time telescope observations of satellites and orbital debris from Devasthal",
            "Data quality assessment, data reduction and photometric analysis",
            "ML/AI-based algorithms for automated detection of satellite streaks in images",
            "Characterising detected streaks and cataloguing their orbital parameters in a database"
        ],
        sources: [
            { label: "ARIES: MoU between ARIES and IRDE", url: "https://www.aries.res.in/node/2073" },
            { label: "DST: DST & DRDO institutes join hands to strengthen ground-based SSA", url: "https://dst.gov.in/dst-drdo-institutes-join-hands-strengthen-ground-based-space-situational-awareness" },
            { label: "ARIES: SSA project funded by IRDE–DRDO", url: "https://www.aries.res.in/node/2141" }
        ]
    },
    {
        id: "bel",
        name: "BEL – Ghaziabad",
        fullName: "Bharat Electronics Limited",
        parent: "Navaratna Defence PSU, Ministry of Defence",
        location: "Ghaziabad, Uttar Pradesh",
        monogram: "BEL",
        teamOrgMatch: ["BEL"],
        summary: "ARIES and Bharat Electronics Limited signed an MoU in September 2024 at BEL's Ghaziabad unit. The goal is to develop critical technologies for tracking near-Earth objects and artificial satellites. The work uses observations from ARIES telescopes, including the 4 m International Liquid Mirror Telescope, together with advanced image processing and data analytics.",
        about: [
            "Bharat Electronics Limited (BEL) is a Navaratna Defence Public Sector Undertaking under the Ministry of Defence that develops and manufactures defence electronics systems. The MoU with ARIES was signed at its Ghaziabad unit.",
            "The partnership is aligned with the Government of India's 'Atmanirbhar Bharat' and 'Make in India' initiatives. It brings together ARIES's observing facilities and expertise with BEL's industrial engineering capability."
        ],
        mou: {
            signed: "September 2024",
            place: "BEL Ghaziabad unit",
            signatories: [
                "Prof. Dipankar Banerjee, then Director, ARIES",
                "Ms. Rashmi Kathuria, General Manager (SCCS) & Unit Head, BEL Ghaziabad"
            ],
            facilities: [
                "4 m International Liquid Mirror Telescope (ILMT), Devasthal",
                "Other ARIES optical telescopes"
            ],
            text: [
                "The MoU's aim is to develop critical technologies for tracking space objects, particularly near-Earth objects and artificial satellites, as part of India's Space Situational Awareness effort.",
                "ARIES will also share its expertise in space weather, and the partners will run training workshops to build capacity in SSA."
            ]
        },
        focusAreas: [
            "Technologies for tracking near-Earth objects and artificial satellites",
            "Advanced image processing and data-analytics solutions for SSA",
            "Observations from ARIES telescopes, including the 4 m ILMT",
            "Training workshops for capacity building in SSA",
            "Knowledge sharing in space weather"
        ],
        workAtAries: [
            "Monitoring resident space objects across orbital regimes with ground-based optical telescopes",
            "Night-time observation, precise tracking and characterisation of satellites and space debris",
            "Data reduction and analysis pipelines, with AI/ML algorithms for automated streak detection and classification",
            "Orbit determination, tracking refinement and visualisation of space-object trajectories",
            "Telescope subsystems, high-speed detector integration, control software and SSA instrument prototypes, developed with industry partners",
            "Scalable data archival and real-time data dissemination systems"
        ],
        sources: [
            { label: "DST: MoU between ARIES & BEL can help tracking satellites for their safety", url: "https://dst.gov.in/mou-between-aries-bel-can-help-tracking-satellites-their-safety" },
            { label: "PSU Watch: ARIES and BEL collaborate to enhance India's SSA", url: "https://psuwatch.com/defencewatch/aries-and-bel-collaborate-to-enhance-indias-space-situational-awareness" },
            { label: "ARIES: SSA project with BEL", url: "https://www.aries.res.in/ssa_project_with_bel" }
        ]
    }
];
