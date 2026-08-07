import { describe, expect, it } from 'vitest';
import type { EmployeeId, RequirementId } from '@yrak/domain';
import { evaluateEligibility } from './eligibility-engine.js';

const employeeId = 'e1' as EmployeeId;
const requirementId = 'r1' as RequirementId;

describe('eligibility', () => {
  it('marca elegible si el requisito cubre todo el periodo', () => {
    const result = evaluateEligibility({ employeeId, requirements: [{ id: requirementId, mandatory: true, validForEntireCoverage: true }], records: [{ requirementId, status: 'COMPLIANT', validUntil: '2026-09-01' }], coverageStart: '2026-08-01', coverageEnd: '2026-08-15' });
    expect(result.eligible).toBe(true);
  });
  it('explica certificación vencida', () => {
    const result = evaluateEligibility({ employeeId, requirements: [{ id: requirementId, mandatory: true, validForEntireCoverage: true }], records: [{ requirementId, status: 'COMPLIANT', validUntil: '2026-08-05' }], coverageStart: '2026-08-01', coverageEnd: '2026-08-15' });
    expect(result.reasons[0]?.code).toBe('EXPIRED');
  });
});
