import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { AppEnv } from './env.js';

interface CoverageWorkflowParams { coverageCaseId:string; startsOn:string; endsOn:string }

export class CoverageWorkflow extends WorkflowEntrypoint<AppEnv,CoverageWorkflowParams>{
  override async run(event:WorkflowEvent<CoverageWorkflowParams>,step:WorkflowStep){
    const payload=event.payload;
    await step.sleepUntil('wait-for-coverage-start',new Date(`${payload.startsOn}T00:00:00.000Z`));
    await step.do('activate-assignment',async()=>{
      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE temporary_assignments SET status='ACTIVE',version=version+1 WHERE coverage_case_id=? AND status='SCHEDULED'`).bind(payload.coverageCaseId),
        this.env.DB.prepare(`UPDATE coverage_cases SET status='ACTIVE',version=version+1,updated_at=datetime('now') WHERE id=? AND status='SCHEDULED'`).bind(payload.coverageCaseId),
      ]);
      return {activated:true};
    });
    await step.sleepUntil('wait-for-coverage-end',new Date(`${payload.endsOn}T23:59:59.000Z`));
    return await step.do('mark-return-due',async()=>{
      const id=crypto.randomUUID();
      const coverage=await this.env.DB.prepare(`SELECT organization_id FROM coverage_cases WHERE id=?`).bind(payload.coverageCaseId).first<{organization_id:string}>();
      if(coverage)await this.env.DB.prepare(`INSERT INTO notifications(id,organization_id,entity_type,entity_id,channel,recipient,template_key,payload_json,status) VALUES(?,?,'COVERAGE_CASE',?,'IN_APP','SYSTEM','RETURN_TO_BASE',?,'PENDING')`).bind(id,coverage.organization_id,payload.coverageCaseId,JSON.stringify({coverageCaseId:payload.coverageCaseId,action:'COMPLETE_DUE'})).run();
      return {returnDue:true};
    });
  }
}
