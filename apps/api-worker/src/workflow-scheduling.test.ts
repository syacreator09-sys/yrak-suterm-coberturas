import { describe, expect, it, vi } from 'vitest';
import type { WorkflowStep } from 'cloudflare:workers';
import { sleepUntilBoundary } from './workflow-scheduling.js';

function fakeStep(doImpl: WorkflowStep['do']): { step: WorkflowStep; sleepUntil: ReturnType<typeof vi.fn> } {
  const sleepUntil = vi.fn(async () => undefined);
  const step = { do: doImpl, sleepUntil } as unknown as WorkflowStep;
  return { step, sleepUntil };
}

describe('sleepUntilBoundary', () => {
  it('sleeps when the boundary is in the future (first execution, callback runs live)', async () => {
    const { step, sleepUntil } = fakeStep((async (_name: string, cb: () => Promise<unknown>) => cb()) as WorkflowStep['do']);
    const future = Date.now() + 60_000;

    await sleepUntilBoundary(step, 'wait-for-coverage-start', future);

    expect(sleepUntil).toHaveBeenCalledExactlyOnceWith('wait-for-coverage-start', future);
  });

  it('skips sleeping when the boundary is already in the past (first execution, callback runs live)', async () => {
    const { step, sleepUntil } = fakeStep((async (_name: string, cb: () => Promise<unknown>) => cb()) as WorkflowStep['do']);
    const past = Date.now() - 60_000;

    await sleepUntilBoundary(step, 'wait-for-coverage-start', past);

    expect(sleepUntil).not.toHaveBeenCalled();
  });

  it('replay: still sleeps on a memoized true decision even though Date.now() would now read the boundary as past', async () => {
    // Simulates a replay after the timer fires: step.do() returns the durable
    // log's cached result instead of re-invoking the callback, exactly as the
    // real Workflows engine does. If sleepUntilBoundary read Date.now() here
    // instead of trusting the memoized decision, it would wrongly skip
    // re-issuing step.sleepUntil and desync from what the engine recorded.
    const { step, sleepUntil } = fakeStep((async () => true) as WorkflowStep['do']);
    const nowReadsAsPast = Date.now() - 60_000;

    await sleepUntilBoundary(step, 'wait-for-coverage-start', nowReadsAsPast);

    expect(sleepUntil).toHaveBeenCalledExactlyOnceWith('wait-for-coverage-start', nowReadsAsPast);
  });

  it('replay: still skips sleeping on a memoized false decision even though Date.now() would now read the boundary as future', async () => {
    const { step, sleepUntil } = fakeStep((async () => false) as WorkflowStep['do']);
    const nowReadsAsFuture = Date.now() + 60_000;

    await sleepUntilBoundary(step, 'wait-for-coverage-start', nowReadsAsFuture);

    expect(sleepUntil).not.toHaveBeenCalled();
  });

  it('memoizes the decision under a name derived from the boundary name, not the boundary name itself', async () => {
    const doSpy = vi.fn(async (_name: string, cb: () => Promise<unknown>) => cb());
    const { step } = fakeStep(doSpy as unknown as WorkflowStep['do']);

    await sleepUntilBoundary(step, 'wait-for-coverage-end', Date.now() + 1000);

    expect(doSpy).toHaveBeenCalledExactlyOnceWith('wait-for-coverage-end-decision', expect.any(Function));
  });
});
