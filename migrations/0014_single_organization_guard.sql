-- YRAK SUTERM/CFE is intentionally deployed as a single-organization system.
-- This also removes an entire class of cross-tenant mistakes in bulk import paths.
CREATE TRIGGER IF NOT EXISTS organizations_single_tenant_insert
BEFORE INSERT ON organizations
WHEN EXISTS (SELECT 1 FROM organizations)
BEGIN
  SELECT RAISE(ABORT, 'SINGLE_ORGANIZATION_DEPLOYMENT');
END;

-- The organization identity is immutable once created.
CREATE TRIGGER IF NOT EXISTS organizations_identity_immutable
BEFORE UPDATE OF id ON organizations
BEGIN
  SELECT RAISE(ABORT, 'ORGANIZATION_ID_IMMUTABLE');
END;
