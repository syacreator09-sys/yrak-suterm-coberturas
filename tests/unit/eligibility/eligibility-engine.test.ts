import { describe, expect, it } from 'vitest';
import { asId } from '../../../packages/domain/src/index.js';
import { evaluateEligibility } from '../../../packages/eligibility/src/index.js';

const employeeId = asId<'EmployeeId'>('EMP-1');
const course = asId<'RequirementId'>('COURSE');
const certificate = asId<'RequirementId'>('CERT');

describe('eligibility engine', () => {
  it('reports every missing or expired requirement', () => {
    const result = evaluateEligibility({
      employeeId,
      requiredRequirementIds: [course, certificate],
      evaluations: [
        { requirementId: certificate, status: 'COMPLIANT', validUntil: '2026-08-10', evidenceId: 'E1' },
      ],
      coverageStartsAt: '2026-08-11',
      coverageEndsAt: '2026-08-20',
      mustRemainValidForEntireCoverage: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.map((reason) => reason.code)).toEqual(['MISSING', 'EXPIRED']);
  });
});
