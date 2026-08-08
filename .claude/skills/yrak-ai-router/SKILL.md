---
name: yrak-ai-router
description: Modify, test or connect YRAK AI providers and agents while keeping provider routing agnostic and AI outside deterministic labor decisions.
---

# YRAK AI router and agents

Provider architecture is replaceable. Do not couple domain logic to NVIDIA, Ollama, Workers AI, OpenAI, Anthropic or any specific model.

Rules:

- Provider selection belongs in `packages/ai-provider` / worker configuration.
- Keep Workers AI/cloud provider choices separate from deterministic domain packages.
- Use task/capability routing and bounded fallback; never retry authorization/configuration errors as if they were transient.
- Provider telemetry must not store prompts, secrets or unnecessary PII.
- Smoke tests use fixed synthetic prompts and must not create coverages, select candidates, move queues, alter scores or send communications.
- Intake, Audit, Communication and Support agents never gain authority to approve or decide labor outcomes.
- A model/provider is not considered healthy because a key exists. Observe an actual synthetic request before reporting health.
- Do not hard-code a model ID from memory. When connecting a provider, inspect its current catalog/config and record the chosen ID in environment/configuration appropriate for that provider.
- Ollama local endpoints must remain loopback/private unless a separately reviewed authentication/network design exists.
