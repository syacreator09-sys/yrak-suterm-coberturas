import type { EmployeeId, RequirementEvaluation, RequirementId } from '@yrak/domain';

export type IneligibilityCode = 'MISSING' | 'EXPIRED' | 'REJECTED' | 'PENDING';

export interface EligibilityReason {
  requirementId: RequirementId;
  code: IneligibilityCode;
  messageKey: string;
}

export interface EligibilityInput {
  employeeId: EmployeeId;
  requiredRequirementIds: readonly RequirementId[];
  evaluations: readonly RequirementEvaluation[];
  coverageStartsAt: string;
  coverageEndsAt: string;
  mustRemainValidForEntireCoverage: boolean;
}

export interface EligibilityResult {
  employeeId: EmployeeId;
  eligible: boolean;
  reasons: readonly EligibilityReason[];
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const byId = new Map(
    input.evaluations.map((evaluation) => [evaluation.requirementId, evaluation]),
  );
  const validityBoundary = input.mustRemainValidForEntireCoverage
    ? input.coverageEndsAt
    : input.coverageStartsAt;
  const reasons: EligibilityReason[] = [];

  for (const requirementId of input.requiredRequirementIds) {
    const evaluation = byId.get(requirementId);
    if (!evaluation || evaluation.status === 'MISSING') {
      reasons.push({ requirementId, code: 'MISSING', messageKey: 'requirement.missing' });
      continue;
    }
    if (evaluation.status === 'PENDING') {
      reasons.push({ requirementId, code: 'PENDING', messageKey: 'requirement.pending' });
      continue;
    }
    if (evaluation.status === 'REJECTED') {
      reasons.push({ requirementId, code: 'REJECTED', messageKey: 'requirement.rejected' });
      continue;
    }
    if (
      evaluation.status === 'EXPIRED' ||
      (evaluation.validUntil !== null &&
        new Date(evaluation.validUntil).getTime() < new Date(validityBoundary).getTime())
    ) {
      reasons.push({ requirementId, code: 'EXPIRED', messageKey: 'requirement.expired' });
    }
  }

  return { employeeId: input.employeeId, eligible: reasons.length === 0, reasons };
}
