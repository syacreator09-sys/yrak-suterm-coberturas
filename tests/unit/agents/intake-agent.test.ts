import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../../../packages/ai-provider/src/index.js';
import { IntakeAgent } from '../../../packages/agents/src/index.js';

const draft = {
  groupId: null,
  absentEmployeeId: 'EMP-1',
  vacantLevelNumber: 8,
  startsAt: '2026-08-10T00:00:00.000Z',
  endsAt: '2026-08-14T00:00:00.000Z',
  reason: 'Vacaciones',
  source: 'AUDIO' as const,
  confidence: 0.9,
  missingFields: ['groupId'],
  notes: [],
  reviewRequired: true as const,
};

describe('IntakeAgent', () => {
  it('always returns a review-required structured draft', async () => {
    const agent = new IntakeAgent(new MockAIProvider('audio', draft));
    await expect(agent.fromText('solicitud', 'AUDIO')).resolves.toEqual(draft);
  });

  it('rejects a provider result that tries to bypass review', async () => {
    const agent = new IntakeAgent(new MockAIProvider('audio', { ...draft, reviewRequired: false }));
    await expect(agent.fromText('solicitud', 'AUDIO')).rejects.toThrow();
  });
});
