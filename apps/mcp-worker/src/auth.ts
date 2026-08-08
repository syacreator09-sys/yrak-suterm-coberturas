export interface McpAuthConfig {
  MCP_API_TOKEN?: string;
  MCP_ORGANIZATION_ID?: string;
}

export function mcpConfigurationState(env: McpAuthConfig) {
  return {
    tokenConfigured: Boolean(env.MCP_API_TOKEN),
    organizationConfigured: Boolean(env.MCP_ORGANIZATION_ID && !env.MCP_ORGANIZATION_ID.startsWith('REPLACE_')),
  };
}

export function isAuthorizedMcpRequest(authorization: string | null, token: string | undefined): boolean {
  return Boolean(token && authorization === `Bearer ${token}`);
}
