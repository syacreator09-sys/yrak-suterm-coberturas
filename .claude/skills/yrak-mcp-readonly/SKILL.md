---
name: yrak-mcp-readonly
description: Build, review or connect the YRAK MCP server while preserving strict read-only semantics, organization scope, access logging and secret handling.
---

# YRAK MCP read-only contract

`apps/mcp-worker` is an inspection surface, not an alternate mutation API.

Rules:

- MCP tools may read coverage cases, rotation queues, employee requirements and audit events.
- Do not add create/update/delete/approve/assign/rank/score/rotate/send tools.
- Every MCP tool invocation must be logged to `mcp_access_log` without logging bearer tokens or model/provider secrets.
- Every SQL query must include organization scope directly or through a verified join.
- Prefer explicit selected columns over `SELECT *` when adding/reviewing tools.
- `MCP_API_TOKEN` stays in ignored local vars or deployment secrets, never `.mcp.json` with a literal value.
- For Claude Code project setup, use environment expansion or `claude mcp add` after the remote/local MCP URL and token exist.
- Test authentication failure, organization-not-configured failure and read-only successful calls with synthetic data before staging.
- If a requested capability mutates state, implement it through the authorized YRAK API/domain flow instead of MCP.
