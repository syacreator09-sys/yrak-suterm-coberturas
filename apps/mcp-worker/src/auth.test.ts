import { describe, expect, it } from 'vitest';
import { isAuthorizedMcpRequest, mcpConfigurationState } from './auth.js';

describe('MCP configuration', () => {
  it('requires both token and a non-placeholder organization', () => {
    expect(mcpConfigurationState({ MCP_API_TOKEN: 'token', MCP_ORGANIZATION_ID: 'org-1' })).toEqual({
      tokenConfigured: true,
      organizationConfigured: true,
    });
    expect(mcpConfigurationState({ MCP_API_TOKEN: 'token', MCP_ORGANIZATION_ID: 'REPLACE_WITH_ORGANIZATION_ID' })).toEqual({
      tokenConfigured: true,
      organizationConfigured: false,
    });
    expect(mcpConfigurationState({})).toEqual({ tokenConfigured: false, organizationConfigured: false });
  });
});

describe('MCP bearer auth', () => {
  it('accepts only an exact bearer token match', () => {
    expect(isAuthorizedMcpRequest('Bearer secret', 'secret')).toBe(true);
    expect(isAuthorizedMcpRequest('Bearer wrong', 'secret')).toBe(false);
    expect(isAuthorizedMcpRequest(null, 'secret')).toBe(false);
    expect(isAuthorizedMcpRequest('Bearer secret', undefined)).toBe(false);
  });
});
