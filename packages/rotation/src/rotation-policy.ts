export interface RotationPolicy {
  justifiedUnavailabilityKeepsPosition: boolean;
  voluntaryRejectionConsumesTurn: boolean;
  cancellationBeforeStartConsumesTurn: boolean;
}

export const defaultRotationPolicy: RotationPolicy = {
  justifiedUnavailabilityKeepsPosition: true,
  voluntaryRejectionConsumesTurn: true,
  cancellationBeforeStartConsumesTurn: false,
};
