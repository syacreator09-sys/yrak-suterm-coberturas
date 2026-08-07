-- A ranking is a derived value. Any input change must invalidate it so an
-- old rank cannot be awarded after a score/participation/rule change.
CREATE TRIGGER IF NOT EXISTS competition_score_invalidates_ranking
AFTER UPDATE OF exam_score ON competition_candidates
WHEN OLD.exam_score IS NOT NEW.exam_score
BEGIN
  UPDATE competition_candidates
     SET rank = NULL,
         result_status = NULL
   WHERE competition_id = NEW.competition_id;
END;

CREATE TRIGGER IF NOT EXISTS competition_participation_invalidates_ranking
AFTER UPDATE OF accepted_participation ON competition_candidates
WHEN OLD.accepted_participation IS NOT NEW.accepted_participation
BEGIN
  UPDATE competition_candidates
     SET rank = NULL,
         result_status = NULL
   WHERE competition_id = NEW.competition_id;
END;

CREATE TRIGGER IF NOT EXISTS competition_rules_change_invalidates_ranking
AFTER UPDATE OF minimum_score, tie_breaker, rules_confirmed ON competitions
WHEN OLD.minimum_score IS NOT NEW.minimum_score
  OR OLD.tie_breaker IS NOT NEW.tie_breaker
  OR OLD.rules_confirmed IS NOT NEW.rules_confirmed
BEGIN
  UPDATE competition_candidates
     SET rank = NULL,
         result_status = NULL
   WHERE competition_id = NEW.id;
END;

-- If HR changes compliance while a competition is still open, the affected
-- candidate must be re-evaluated instead of keeping an old eligibility/rank.
CREATE TRIGGER IF NOT EXISTS employee_requirement_change_requires_reevaluation
AFTER UPDATE OF status, valid_until, score ON employee_requirements
BEGIN
  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE employee_id = NEW.employee_id
     AND competition_id IN (
       SELECT cp.id
         FROM competitions cp
        WHERE cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
     );
END;

-- Changing what a target level requires also invalidates open eligibility.
CREATE TRIGGER IF NOT EXISTS target_requirement_change_requires_reevaluation
AFTER UPDATE ON target_level_requirements
BEGIN
  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE competition_id IN (
     SELECT cp.id
       FROM competitions cp
       JOIN coverage_cases cc ON cc.id = cp.coverage_case_id
      WHERE cc.target_level_id = NEW.target_level_id
        AND cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
   );
END;

-- The current rotation completion service updates all queue positions in one
-- batch. Only the employee whose times_selected increases is allowed to get a
-- new last_coverage_at timestamp; all other rows retain their historical value.
CREATE TRIGGER IF NOT EXISTS preserve_last_coverage_for_non_selected
AFTER UPDATE OF last_coverage_at, times_selected ON rotation_queue_entries
WHEN NEW.times_selected = OLD.times_selected
 AND NEW.last_coverage_at IS NOT OLD.last_coverage_at
BEGIN
  UPDATE rotation_queue_entries
     SET last_coverage_at = OLD.last_coverage_at
   WHERE id = NEW.id;
END;
