import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
export const meRoutes=new Hono<AppBindings>();
meRoutes.get('/',async c=>{
  const u=c.get('user');
  if(!u.employeeId)return c.json({user:u,employee:null,requirements:[],assignments:[]});
  const employee=await c.env.DB.prepare(`SELECT id,employee_number,name,email,group_id,base_level_id,seniority_date FROM employees WHERE id=? AND organization_id=?`).bind(u.employeeId,u.organizationId).first();
  const requirements=await c.env.DB.prepare(`SELECT r.name,r.requirement_type,er.status,er.completed_at,er.valid_until,er.score FROM employee_requirements er JOIN requirements r ON r.id=er.requirement_id WHERE er.employee_id=? ORDER BY r.name`).bind(u.employeeId).all();
  const assignments=await c.env.DB.prepare(`SELECT a.id,a.coverage_case_id,a.base_level_id,a.target_level_id,a.starts_on,a.ends_on,a.status,a.returned_at FROM temporary_assignments a JOIN coverage_cases c ON c.id=a.coverage_case_id WHERE a.employee_id=? AND c.organization_id=? ORDER BY a.starts_on DESC`).bind(u.employeeId,u.organizationId).all();
  return c.json({user:u,employee,requirements:requirements.results??[],assignments:assignments.results??[]});
});
