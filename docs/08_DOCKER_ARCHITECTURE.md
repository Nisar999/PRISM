> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For the current architecture, see [ARCHITECTURE_V1.md](ARCHITECTURE_V1.md).

# Docker Architecture

Everything must run with:

docker compose up

---

Services

frontend

backend

worker

postgres

neo4j

qdrant

redis

ollama

prometheus

grafana

---

Frontend

NextJS

Port:

3000

---

Backend

FastAPI

Port:

8000

---

PostgreSQL

Port:

5432

---

Neo4j

Ports:

7474

7687

---

Qdrant

Port:

6333

---

Redis

Port:

6379

---

Ollama

Port:

11434

---

Grafana

Port:

3001

---

Prometheus

Port:

9090

---

Rules

Every service:

Health Check

Restart Policy

Named Volumes

Persistent Storage

---

Single command:

docker compose up

↓

PRISM OS boots.

Everything ready.

No manual setup.