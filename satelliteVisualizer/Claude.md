# Satellite Visualization System

## Purpose

This project is an interactive web-based visualization system for the
ARIES (Aryabhatta Research Institute of Observational Sciences)
Space Situational Awareness (SSA) project.

The application visualizes Earth-orbiting satellites using current
orbital elements, allowing researchers to inspect satellite positions,
ground tracks, visibility, and observational data.

This is a scientific visualization tool.
Accuracy, correctness, and reliability are more important than visual effects.

---

# Technology Stack

Frontend
- HTML
- CSS
- JavaScript

Visualization
- CesiumJS

Backend
- Node.js
- Express

Orbit Propagation
- satellite.js
- CelesTrak TLEs

Networking
- Cloudflare Tunnel

---

# Development Philosophy

When modifying this project:

- Prefer correctness over aesthetics.
- Preserve existing functionality.
- Make small, incremental changes.
- Avoid unnecessary refactoring.
- Keep code modular and readable.
- Explain architectural changes before implementing them.
- Do not introduce large dependencies unless requested.

---

# Priority Order

Work on the project in the following order.

## Stage 1 — Audit

Before changing any code:

Inspect the visualization system and identify:

- runtime errors
- duplicated code
- dead code
- broken routes
- incorrect async usage
- rendering issues
- propagation issues
- missing error handling
- security concerns
- performance bottlenecks

Produce an audit report.

Do not modify code during this stage.

---

## Stage 2 — Stabilization

After the audit:

Fix confirmed issues while preserving all existing functionality.

Requirements:

- minimal code changes
- backward compatibility
- explain each fix

---

## Stage 3 — Orbit Propagation

Review the existing propagation implementation.

Goals:

- verify TLE loading
- verify propagation accuracy
- improve CelesTrak integration
- handle propagation failures gracefully
- improve maintainability where appropriate

Preserve existing APIs whenever possible.

---

## Stage 4 — Visualization Validation

Verify that:

- Earth renders correctly
- satellites render correctly
- ground tracks are correct
- timestamps are correct
- observer location behaves correctly
- orbit updates function correctly
- console contains no runtime errors
- browser performance remains acceptable

---

## Stage 5 — UI Improvements

Only after the visualization system is stable:

Improve the interface while maintaining a professional,
scientific appearance.

Avoid:

- flashy animations
- excessive effects
- unnecessary complexity

Prefer:

- clean layout
- modern aerospace styling
- readable typography
- responsive design

---

# Coding Guidelines

- Use async/await.
- Keep functions focused.
- Handle errors explicitly.
- Validate external data.
- Use descriptive variable names.
- Add comments only when logic is non-obvious.

---

# Security

Never:

- expose secrets
- hardcode credentials
- trust external API responses
- expose internal server paths

Always:

- validate inputs
- sanitize user-controlled values
- fail gracefully

---

# Long-Term Goal

This visualization system will eventually become a module within the
larger ARIES Observe.

Future integration requirements:

- Preserve modularity.
- Avoid assumptions about routing.
- Avoid hardcoded URLs.
- Make integration into the larger portal straightforward.
- Keep authentication compatible with the main portal.

Design all future changes with this integration in mind.


# Working Style

Before implementing significant changes:

1. Inspect the existing implementation.
2. Explain the proposed solution.
3. Wait only if a breaking architectural change is required.
4. Otherwise implement incrementally.
5. Summarize modified files and reasons for each change.

Avoid making unrelated changes.