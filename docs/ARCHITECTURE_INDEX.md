# PRISM Architecture Index (v0.9.0 Alpha)

This document is the official directory and navigation guide for the **PRISM Architecture**. It outlines the structure, dependencies, and relationships of the canonical specifications to help both human developers and autonomous AI agents navigate the system.

---

## Documentation Philosophy

PRISM documentation follows a strict three-layer architecture. Documents are cross-referenced, never duplicated.

| Layer | Purpose | Location |
|-------|---------|----------|
| **Layer 0 — Product** | Locked product identity, roadmap, non-goals. Wins on product conflicts. | `docs/11_PRODUCT_CONSTITUTION.md` |
| **Layer 1 — Historical** | Original design documents. Preserved as-is with deprecation notices pointing to Layer 0/2. | `docs/01` to `docs/10` |
| **Layer 2 — Current Architecture** | Frozen specs + new architecture docs. Single source of truth for the current system. | `docs/ARCHITECTURE_V1.md`, frozen docs |
| **Layer 3 — Developer** | Onboarding, contribution, development guides. References Layer 0/2, never duplicates them. | `docs/CONTRIBUTING.md`, `docs/DEVELOPMENT_GUIDE.md` |

---

## Canonical Document Directory

### Layer 0: Product Constitution

- [Product Constitution](11_PRODUCT_CONSTITUTION.md) — Locked identity: Agentic Intelligent Workspace; VS Code is editing engine; roadmap v1→v2→Future.

### Layer 1: Historical Design Documents

These documents represent the initial design phase of PRISM. They are preserved for historical context. On product-identity conflicts, Layer 0 wins.

- `01_VISION.md`
- `02_PRD.md`
- `03_ARCHITECTURE.md` (Legacy version of ARCHITECTURE_V1.md)
- `04_REPOSITORY_STRUCTURE.md`
- `05_LLM_PROVIDER_SPEC.md`
- `06_VISUAL_COGNITION.md`
- `07_AGENT_SPEC.md`
- `08_DOCKER_ARCHITECTURE.md`
- `09_CODING_STANDARDS.md`
- `10_ADR.md` (Legacy version of ARCHITECTURE_DECISIONS.md)

---

### Layer 2: Current Architecture

These documents define the v0.9.0 Alpha system.

#### System Overviews
- [Architecture V1](ARCHITECTURE_V1.md) — Comprehensive architecture covering all layers.
- [Service Overview](SERVICE_OVERVIEW.md) — Subsystem and manager relationships.
- [Component Map](COMPONENT_MAP.md) — UI composition and file mapping.
- [Event Flow](EVENT_FLOW.md) — Data flow, event bus, and store subscriptions.
- [Architecture Decisions](ARCHITECTURE_DECISIONS.md) — Key decisions and rationale.
- [Glossary](GLOSSARY.md) — PRISM terminology.

#### Frozen Specifications (v1.0 Design)
- [Architecture Freeze](ARCHITECTURE_FREEZE.md) — Governance and change policy.
- [Experience Architecture](EXPERIENCE_ARCHITECTURE.md) — UX principles and user journeys.
- [UI Design Language](UI_DESIGN_LANGUAGE.md) — Color tokens, layouts, typography.
- [Interaction Language](INTERACTION_LANGUAGE.md) — Text and communication patterns.
- [Command Surface](COMMAND_SURFACE.md) — Command palette specification.
- [Workspace System](WORKSPACE_SYSTEM.md) — Project/Session/Artifact model.
- [Visual Cognition](VISUAL_COGNITION.md) — Graph and state visualization.
- [Motion Language](MOTION_LANGUAGE.md) — Animation timing and curves.
- [Milly Experience](MILLY_EXPERIENCE.md) — Cognitive presence specification.
- [Brand Assets](BRAND_ASSETS.md) — Logo, icons, fonts.

#### Alignment Documents
- [Design System](DESIGN_SYSTEM.md) — Implementation mapping of UI Design Language.
- [Implementation Audit](IMPLEMENTATION_AUDIT.md) — Current state vs Frozen Specs.
- [V1 Scope](V1_SCOPE.md) — Feature milestones and delivery roadmap.
- [API Surface](API_SURFACE.md) — Canonical desktop ↔ backend REST/WS contract.
- [Desktop Shell](DESKTOP_SHELL.md) — Canonical PRISM Desktop layout and VS Code insertion point.

---

### Layer 3: Developer Guidelines

These documents guide contributors in interacting with the codebase.

- [Development Guide](DEVELOPMENT_GUIDE.md) — Local setup, debugging, execution pipelines.
- [Contributing](CONTRIBUTING.md) — PR rules, AI agent guidelines, coding standards.

---

## Reading Orders

### For New Contributors
1. [Product Constitution](11_PRODUCT_CONSTITUTION.md)
2. [Architecture V1](ARCHITECTURE_V1.md)
3. [Glossary](GLOSSARY.md)
4. [Development Guide](DEVELOPMENT_GUIDE.md)

### For Backend Engineers
1. [Product Constitution](11_PRODUCT_CONSTITUTION.md)
2. [Architecture V1](ARCHITECTURE_V1.md)
3. [Service Overview](SERVICE_OVERVIEW.md)
4. [Event Flow](EVENT_FLOW.md)

### For Desktop Engineers
1. [Product Constitution](11_PRODUCT_CONSTITUTION.md)
2. [Architecture V1](ARCHITECTURE_V1.md)
3. [Component Map](COMPONENT_MAP.md)
4. [Design System](DESIGN_SYSTEM.md)

### For AI Agents
1. [Product Constitution](11_PRODUCT_CONSTITUTION.md)
2. [Architecture Freeze](ARCHITECTURE_FREEZE.md)
3. [Implementation Audit](IMPLEMENTATION_AUDIT.md)
4. [V1 Scope](V1_SCOPE.md)
