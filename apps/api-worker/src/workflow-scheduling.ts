import { Temporal } from '@js-temporal/polyfill';
import type { WorkflowStep } from 'cloudflare:workers';

export function boundary(date: string, timeZone: string, end = false): number {
  return Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone, plainTime: end ? Temporal.PlainTime.from('23:59:59') : Temporal.PlainTime.from('00:00:00') })
    .toInstant().epochMilliseconds;
}

// Cloudflare Workflows rejects step.sleepUntil(...) outright ("You can't
// sleep until a time in the past, time-traveler") when the target instant
// has already elapsed — it does not treat it as a no-op. A coverage case
// approved with a starts_on/ends_on date already in the past (common in a
// demo/backfill scenario, and possible in production if approval lags the
// start date) would otherwise crash the whole workflow instance at that
// step, permanently stranding the case at SCHEDULED with no visible error
// outside `wrangler workflows instances describe`.
//
// The "should we sleep at all" decision is memoized via step.do() rather
// than read from a bare Date.now() in the run() body. Workflows replays the
// entire run() function on every resumption and matches step.* calls made
// during replay against its durable log by name/order — a bare Date.now()
// check would correctly decide to call step.sleepUntil on the original
// (pre-suspend) pass, but on the replay that happens when that sleep's
// timer actually fires, real time has by definition already passed the
// boundary, so the same bare check would silently skip re-issuing the
// matching step.sleepUntil call and desync the replay from what the engine
// already recorded. Memoizing the decision once removes that hazard: on
// replay, step.do() returns the cached decision without re-running the
// callback, so the sequence of step.* calls stays identical across every
// replay of a given execution — see workflow-scheduling.test.ts for the
// determinism property this guarantees.
export async function sleepUntilBoundary(step: WorkflowStep, name: string, epochMilliseconds: number): Promise<void> {
  const shouldSleep = await step.do(`${name}-decision`, async () => epochMilliseconds > Date.now());
  if (shouldSleep) await step.sleepUntil(name, epochMilliseconds);
}
