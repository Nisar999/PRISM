# Contributing to PRISM

Thank you for your interest in contributing to PRISM! 

## Philosophy

PRISM operates on a strict set of architectural and design rules to ensure consistency across its core backend and desktop shell. 

Before you contribute, please review the frozen architectures:
- [Architecture Freeze](ARCHITECTURE_FREEZE.md)
- [Architecture V1](ARCHITECTURE_V1.md)

## Development Environment Setup

See the [Development Guide](DEVELOPMENT_GUIDE.md) for detailed instructions on bootstrapping the backend and desktop environments locally.

## Contribution Workflow

### For Human Developers

1. **Check the Issue Tracker**: Look for issues marked `good first issue` or `help wanted`.
2. **Branch Naming**:
   - Features: `feature/short-description`
   - Bug Fixes: `fix/short-description`
   - Docs: `docs/short-description`
3. **Commit Standards**: We follow Conventional Commits (e.g., `feat: add provider fallback`, `fix: resolve websocket disconnect`).
4. **Pull Requests**:
   - Ensure all tests pass.
   - Run the Desktop TypeScript build (`npm run build`).
   - Describe the changes and link to any relevant issues.

### For Autonomous AI Agents

Agents contributing to PRISM must follow the standard development workflow (documented in `.prism/brain/07_workflows.md`).

1. **Read PRISM Brain**: Start by reading the root `README.md` and the documents in `.prism/brain/`.
2. **Context Restriction**: Inspect *only* the relevant files. Do not scan the entire codebase unless required.
3. **Follow Coding Standards**: See the coding conventions outlined below.
4. **Update the Brain**: If you change the architecture, you *must* update the relevant documentation in `docs/` and `.prism/brain/`.
5. **Generate Walkthrough**: Always generate an execution walkthrough upon completing a task.

## Coding Standards Summary

### Backend (Python)
- Use **FastAPI** for API routes.
- Use **Pydantic** for all data validation.
- All routes and core functions must be `async`.
- Do not bypass the `ProviderManager` or `MemoryEngine` abstractions.

### Desktop (TypeScript/React)
- Use **Functional Components** and **React 19 Hooks**.
- Do not use Redux or global mutable singletons.
- Use the **Manager → Store → Hook** pattern for state management.
- Styling must use **TailwindCSS** and **shadcn/ui** primitives exclusively.

## Code of Conduct

Be respectful. PRISM is open source, and we value collaborative, constructive feedback over ego.
