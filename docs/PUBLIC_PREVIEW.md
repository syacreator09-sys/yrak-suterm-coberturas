# YRAK Public Preview

This document describes the isolated visual preview of the YRAK Control Center.

## Purpose

The preview exists only to review the approved UI composition in a browser without requiring Vercel team access.

## Safety boundary

The public preview:

- uses synthetic demonstration data only;
- makes no YRAK API requests;
- does not load `/v1/me`;
- does not connect D1, R2, Supabase, Upstash, Modal, AI providers, RAG or Gmail;
- contains no credentials or production identifiers;
- has no functional mutation controls;
- may be deleted independently of the real YRAK system.

The authenticated Control Center remains a separate runtime and continues to require its real session/API path.

## Verification before sharing

1. Preview output contains `Preview visual · datos demo`.
2. Preview network activity consists only of static assets.
3. Anonymous/incognito access returns the preview rather than a platform access-request screen.
4. Desktop composition is compared against the approved 1536×1024 reference.
5. Mobile layout is checked for overflow and navigation usability.

## Canonical design and plan

- `docs/superpowers/specs/2026-08-08-public-control-center-preview-design.md`
- `docs/superpowers/plans/2026-08-08-public-control-center-preview.md`
