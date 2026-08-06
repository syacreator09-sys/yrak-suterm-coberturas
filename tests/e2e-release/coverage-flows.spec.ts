import { expect, test } from '@playwright/test';

function idempotencyHeaders() {
  return { 'idempotency-key': crypto.randomUUID() };
}

test('5 days uses rotation and preserves the employee base level', async ({ request }) => {
  const response = await request.post('/api/v1/coverages', {
    headers: idempotencyHeaders(),
    data: {
      absentEmployeeId: 'EMP-8-ABSENT-E2E',
      reason: 'Vacaciones E2E de cinco días',
      startsAt: '2026-08-10T06:00:00.000Z',
      endsAt: '2026-08-14T06:00:00.000Z',
      source: 'MANUAL',
    },
  });
  expect(response.status()).toBe(201);
  const created = (await response.json()) as {
    caseId: string;
    processType: string;
    durationDays: number;
    rotation: { employeeId: string; approvalId: string };
  };
  expect(created.processType).toBe('ROTATION');
  expect(created.durationDays).toBe(5);
  expect(created.rotation.employeeId).toBe('EMP-7-A-E2E');

  const approval = await request.post(`/api/v1/approvals/${created.rotation.approvalId}/decide`, {
    headers: idempotencyHeaders(),
    data: { decision: 'APPROVED', reason: 'Aprobación funcional E2E' },
  });
  expect(approval.ok()).toBeTruthy();

  const employees = await request.get('/api/v1/employees');
  expect(employees.ok()).toBeTruthy();
  const employeeItems = (
    (await employees.json()) as { items: Array<{ id: string; base_level_id: string }> }
  ).items;
  expect(employeeItems.find((item) => item.id === 'EMP-7-A-E2E')?.base_level_id).toBe(
    'LEVEL-7-E2E',
  );
});

test('6 days opens a competition and evaluates candidates', async ({ request }) => {
  const response = await request.post('/api/v1/coverages', {
    headers: idempotencyHeaders(),
    data: {
      absentEmployeeId: 'EMP-8-ABSENT-E2E',
      reason: 'Vacaciones E2E de seis días',
      startsAt: '2026-08-17T06:00:00.000Z',
      endsAt: '2026-08-22T06:00:00.000Z',
      source: 'MANUAL',
      competition: {
        registrationStartsAt: '2026-08-06T15:00:00.000Z',
        registrationEndsAt: '2026-08-08T23:00:00.000Z',
        examAt: '2026-08-09T16:00:00.000Z',
        minimumScore: 70,
        tieBreakers: [{ type: 'SENIORITY' }, { type: 'EMPLOYEE_ID' }],
      },
    },
  });
  expect(response.status()).toBe(201);
  const created = (await response.json()) as {
    processType: string;
    durationDays: number;
    competition: { competitionId: string; eligibleCount: number; ineligibleCount: number };
  };
  expect(created.processType).toBe('COMPETITION');
  expect(created.durationDays).toBe(6);
  expect(created.competition.eligibleCount).toBe(2);
  expect(created.competition.ineligibleCount).toBe(0);

  const competition = await request.get(
    `/api/v1/competitions/${created.competition.competitionId}`,
  );
  expect(competition.ok()).toBeTruthy();
  const details = (await competition.json()) as {
    candidates: Array<{ employee_id: string; eligibility_status: string }>;
  };
  expect(details.candidates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ employee_id: 'EMP-7-A-E2E', eligibility_status: 'ELIGIBLE' }),
      expect.objectContaining({ employee_id: 'EMP-7-B-E2E', eligibility_status: 'ELIGIBLE' }),
    ]),
  );
});
