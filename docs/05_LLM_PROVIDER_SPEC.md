> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For the current architecture, see [SERVICE_OVERVIEW.md](SERVICE_OVERVIEW.md).

# LLM Provider Architecture

PRISM OS supports:

Local

- Ollama

- LM Studio

Cloud

- OpenRouter

- OpenAI

- Anthropic

- Gemini

---

Provider Priority

User Selected

↓

Local Provider

↓

OpenRouter

↓

Direct Provider API

---

Provider Interface

All providers implement:

chat()

stream()

embed()

vision()

tools()

models()

health()

---

Example

llm.chat(

model="claude-4-sonnet"

)

or

llm.chat(

model="deepseek-r1"

)

or

llm.chat(

model="llama3"

)

same API.

---

LiteLLM

Use LiteLLM as provider abstraction.

Never call provider SDKs directly.

---

Fallback

if model fails:

↓

OpenRouter

↓

Another provider

↓

Local model

↓

Graceful error