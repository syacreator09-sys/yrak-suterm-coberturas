---
name: yrak-rag-connectors
description: Implement or connect YRAK RAG ingestion/retrieval using R2, Supabase pgvector, optional Modal/Hugging Face and optional Upstash without replacing D1 canonical labor state.
---

# YRAK RAG connector rules

RAG is a knowledge sidecar. D1 remains canonical for labor transactions and deterministic decisions.

Required boundaries:

- Documents/evidence may live in R2; vector/document metadata may use Supabase/Postgres + pgvector after the adapter exists.
- Do not dual-write canonical coverage/assignment/rotation/competition state into Supabase as a second source of truth.
- Apply organization/security/group/document-status filters before retrieved text reaches any LLM.
- Preserve document versions and provenance; do not overwrite historical policy evidence in place.
- Retrieval should support citations back to document/page/section/chunk when those fields exist.
- Modal/Hugging Face are compute/model options, not authoritative storage.
- Upstash is optional cache/rate-limit/deduplication infrastructure; do not make it mandatory until measured need exists.
- Do not mark RAG healthy merely because credentials are present. Require ingestion + retrieval + citation smoke tests using synthetic/non-sensitive documents.
- Never store provider keys in browser `VITE_*` variables.
