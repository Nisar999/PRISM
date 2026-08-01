> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For the current repository structure, see [COMPONENT_MAP.md](COMPONENT_MAP.md).

# Repository Structure

PRISM OS follows a modular monorepo architecture.

Every layer is independent.

No circular dependencies.

---

prism-os/

docs/

frontend/

backend/

docker/

.cursor/

---

frontend/

src/

app/

components/

features/

workspace/

chat/

projects/

files/

browser/

terminal/

memory/

prism-view/

globe-view/

thought-view/

mirror-view/

timeline/

hooks/

lib/

store/

types/

styles/

---

backend/

prism/

api/

agents/

planner/

retrieval/

reasoning/

reflection/

trust/

curator/

memory/

classifier/

scorer/

retrieval/

healing/

storage/

postgres/

neo4j/

qdrant/

redis/

providers/

ollama/

lmstudio/

openrouter/

openai/

anthropic/

gemini/

core/

config/

security/

tests/

---

docker/

frontend/

backend/

postgres/

neo4j/

qdrant/

redis/

ollama/

grafana/

prometheus/

---

rules

Every module owns:

- models

- services

- tests

- interfaces

Never access another module directly.

Use interfaces.