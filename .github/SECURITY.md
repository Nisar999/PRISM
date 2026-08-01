# Security Policy

## Reporting a Vulnerability

PRISM is a local-first desktop application. We take security reports
seriously and ask that you **do not open public issues** for security
problems.

Please report suspected vulnerabilities **privately** by emailing the
maintainer at **security@prism.dev** (replace with the project's
dedicated address when one is published). Include:

- A description of the issue and its impact.
- Steps to reproduce (minimal repro preferred).
- Affected version / commit.
- Any suggested remediation.

You will receive an acknowledgement within **5 business days**. We will
coordinate a fix and credit reporters in the release notes unless you
prefer to remain anonymous.

## Scope

The PRISM-owned code in this repository (`backend/`, `desktop/`,
`docker/`, `scripts/`) is in scope. The vendored `vscode-main/` tree is
**out of scope** — report VS Code / Code-OSS issues upstream.

## Local-First Threat Model

PRISM stores user profiles, encrypted sessions, and workspace data on
the local disk. There is no cloud authentication in v1. Treat the
host machine as the trust boundary: an attacker with local user-level
access to the machine is outside the model.

## What Is Not a Vulnerability

- The placeholder dev defaults in `.env.example` and
  `docker/docker-compose.yml` (`prism_secret`, `prism_neo4j_secret`,
  `change-me-in-production`) are intentional local-dev defaults and
  must be replaced before any deployment.
- The absence of OAuth / cloud login is by design (see
  `docs/ARCHITECTURE_DECISIONS.md`, "Identity before Authentication").
