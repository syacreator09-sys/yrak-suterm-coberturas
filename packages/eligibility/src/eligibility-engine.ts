import type { EmployeeId, RequirementId } from '@yrak/domain';
import type { RequirementStatus } from '@yrak/domain';

export interface RequirementDefinition {
  id: RequirementId;
  mandatory: boolean;
  validForEntireCoverage: boolean;
}

export interface EmployeeRequirementRecord {
  requirementId: RequirementId;
  status: RequirementStatus;
  validUntil?: string;
}

export interface EligibilityResult {
  employeeId: EmployeeId;
  eligible: boolean;
  reasons: Array<{ requirementId: RequirementId; code: 'MISSING' | 'EXPIRED' | 'PENDING' | 'REJECTED' }>;
}

export function evaluateEligibility(input: {
  employeeId: EmployeeId;
  requirements: readonly RequirementDefinition[];
  records: readonly EmployeeRequirementRecord[];
  coverageStart: string;
  coverageEnd: string;
}): EligibilityResult {
  const byRequirement = new Map(input.records.map((record) => [record.requirementId, record]));
  const reasons: EligibilityResult['reasons'] = [];

  for (const requirement of input.requirements.filter((item) => item.mandatory)) {
    const record = byRequirement.get(requirement.id);
    if (!record || record.status === 'MISSING') { reasons.push({ requirementId: requirement.id, code: 'MISSING' }); continue; }
    if (record.status === 'PENDING') { reasons.push({ requirementId: requirement.id, code: 'PENDING' }); continue; }
    if (record.status === 'REJECTED') { reasons.push({ requirementId: requirement.id, code: 'REJECTED' }); continue; }
    if (record.status === 'EXPIRED') { reasons.push({ requirementId: requirement.id, code: 'EXPIRED' }); continue; }
    if (record.status !== 'COMPLIANT' && record.status !== 'NOT_APPLICABLE') { reasons.push({ requirementId: requirement.id, code: 'MISSING' }); continue; }
    if (record.status === 'COMPLIANT' && record.validUntil) {
      const requiredThrough = requirement.validForEntireCoverage ? input.coverageEnd : input.coverageStart;
      if (record.validUntil < requiredThrough) reasons.push({ requirementId: requirement.id, code: 'EXPIRED' });
    }
  }

  return { employeeId: input.employeeId, eligible: reasons.length === 0, reasons };
}
