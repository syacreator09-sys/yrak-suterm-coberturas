import type { AuthUser } from '../env.js';

export function canProvisionRole(actorRole: AuthUser['role'], targetRole: AuthUser['role']): boolean {
  if (actorRole === 'ADMIN') return true;
  if (actorRole !== 'HR') return false;
  return ['SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'EMPLOYEE'].includes(targetRole);
}
