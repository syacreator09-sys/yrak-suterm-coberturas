import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { renderPageError } from '../core/page-utils.js';
import { escapeText } from '../core/security.js';
import { confirmCriticalAction, renderField, renderJson, renderLoading, renderTable, showToast, withBusy } from '../components/ui.js';

type Row = Record<string, unknown>;
interface CompetitionDetail { competition: Row; candidates: Row[] }

export async function renderCompetitions(ctx: PageContext): Promise<void> {
  ctx.setTitle('Concursos 6+', 'Elegibilidad, calificaciones, ranking y adjudicación humana');
  ctx.root.innerHTML = renderLoading('Cargando concursos…');
  const canManage = ['ADMIN', 'HR', 'COMMITTEE'].includes(ctx.session.user.role);

  try {
    const coverages = (await api.get<ListResponse<Row>>('/v1/coverage-cases')).items
      .filter((row) => String(row.process_type ?? '').toUpperCase() === 'COMPETITION');

    ctx.root.innerHTML = `<div class="page-stack">
      <section class="page-grid">
        ${canManage ? `<article class="panel span-5"><h2>Evaluar elegibilidad</h2><form id="competition-evaluate-form">
          ${renderField('Coverage Case ID', '<input name="caseId" required>')}
          <div class="form-actions"><button class="primary" type="submit">Evaluar requisitos</button></div>
        </form><div id="competition-evaluate-output"></div></article>` : ''}
        <article class="panel ${canManage ? 'span-7' : 'span-12'}"><h2>Abrir concurso</h2><form id="competition-load-form" class="toolbar"><div class="toolbar-group"><input name="competitionId" placeholder="Competition ID" required><button class="primary" type="submit">Cargar</button></div></form><div id="competition-detail" class="page-stack"></div></article>
      </section>
      <section class="panel"><div class="section-heading"><div><h2>Coberturas que requieren concurso</h2><p>La clasificación 6+ proviene del motor de reglas.</p></div></div>${renderTable(coverages, [
        { key: 'id', label: 'Coverage Case ID' },
        { key: 'group_id', label: 'Grupo' },
        { key: 'target_level_id', label: 'Nivel destino' },
        { key: 'starts_on', label: 'Inicio' },
        { key: 'ends_on', label: 'Fin' },
        { key: 'effective_days', label: 'Días' },
        { key: 'status', label: 'Estado' },
      ])}</section>
    </div>`;

    ctx.root.querySelector<HTMLFormElement>('#competition-evaluate-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const caseId = String(new FormData(form).get('caseId') ?? '').trim();
        const result = await api.post(`/v1/competitions/cases/${encodeURIComponent(caseId)}/evaluate`);
        ctx.root.querySelector<HTMLElement>('#competition-evaluate-output')!.innerHTML = `<div class="alert alert-info" style="margin-top:12px">La elegibilidad fue calculada por el backend; la UI sólo muestra el resultado.</div>${renderJson(result)}`;
        showToast('Elegibilidad evaluada.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#competition-load-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = String(new FormData(event.currentTarget as HTMLFormElement).get('competitionId') ?? '').trim();
      if (id) await renderCompetitionDetail(ctx, id, canManage);
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}

async function renderCompetitionDetail(ctx: PageContext, id: string, canManage: boolean): Promise<void> {
  const target = ctx.root.querySelector<HTMLElement>('#competition-detail');
  if (!target) return;
  target.innerHTML = renderLoading('Cargando concurso…');
  try {
    const detail = await api.get<CompetitionDetail>(`/v1/competitions/${encodeURIComponent(id)}`);
    const rawMinimum = Number(detail.competition.minimum_score ?? 0);
    const minimumScore = Number.isFinite(rawMinimum) ? Math.min(100, Math.max(0, rawMinimum)) : 0;
    const tieBreaker = String(detail.competition.tie_breaker ?? 'SENIORITY');
    target.innerHTML = `<article class="panel"><h2>Concurso</h2><dl class="key-value">
      <dt>ID</dt><dd>${escapeText(detail.competition.id ?? id)}</dd>
      <dt>Estado</dt><dd>${escapeText(detail.competition.status ?? '—')}</dd>
      <dt>Cobertura</dt><dd>${escapeText(detail.competition.coverage_case_id ?? '—')}</dd>
      <dt>Nivel destino</dt><dd>${escapeText(detail.competition.target_level_id ?? '—')}</dd>
      <dt>Reglas confirmadas</dt><dd>${escapeText(detail.competition.rules_confirmed ?? '—')}</dd>
      <dt>Calificación mínima</dt><dd>${escapeText(detail.competition.minimum_score ?? '—')}</dd>
      <dt>Desempate</dt><dd>${escapeText(tieBreaker)}</dd>
    </dl></article>
    ${canManage ? `<article class="panel"><h3>Reglas del examen</h3><form id="competition-config-form" class="form-grid">
      ${renderField('Calificación mínima', `<input name="minimumScore" type="number" min="0" max="100" value="${minimumScore}" required>`)}
      ${renderField('Desempate', `<select name="tieBreaker"><option value="SENIORITY" ${tieBreaker === 'SENIORITY' ? 'selected' : ''}>Antigüedad</option><option value="EMPLOYEE_NUMBER" ${tieBreaker === 'EMPLOYEE_NUMBER' ? 'selected' : ''}>Número de trabajador</option></select>`)}
      <div class="form-actions"><button class="primary" type="submit">Confirmar reglas</button></div>
    </form></article>` : ''}
    <article class="panel"><h3>Candidatos</h3>${renderTable(detail.candidates, [
      { key: 'id', label: 'Candidate ID' },
      { key: 'employee_number', label: 'Número' },
      { key: 'name', label: 'Nombre' },
      { key: 'eligibility_status', label: 'Elegibilidad' },
      { key: 'accepted_participation', label: 'Aceptó' },
      { key: 'exam_score', label: 'Calificación' },
      { key: 'rank', label: 'Ranking' },
      { key: 'result_status', label: 'Resultado' },
    ])}
    ${canManage ? `<form id="competition-score-form" class="form-grid" style="margin-top:16px">
      ${renderField('Candidate ID', '<input name="candidateId" required>')}
      ${renderField('Calificación', '<input name="score" type="number" min="0" max="100" step="0.01" required>')}
      ${renderField('Motivo', '<input name="reason" value="CAPTURE" required>')}
      <div class="form-actions"><button class="primary" type="submit">Guardar calificación</button></div>
    </form>
    <div class="actions"><button class="secondary" id="competition-rank" type="button">Calcular ranking</button><button class="primary" id="competition-award" type="button">Adjudicar #1</button></div>` : ''}</article>
    ${canManage ? `<article class="panel"><h3>Control dual de calificación</h3><form id="score-revision-form" class="form-grid">
      ${renderField('Revision ID', '<input name="revisionId" required>')}
      <div class="form-actions"><button class="primary" type="submit">Aprobar como segundo revisor</button><button class="danger" type="button" id="revision-reject">Rechazar revisión</button></div>
    </form></article>` : ''}`;

    const refresh = () => renderCompetitionDetail(ctx, id, canManage);

    target.querySelector<HTMLFormElement>('#competition-config-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        await api.patch(`/v1/competitions/${encodeURIComponent(id)}/config`, {
          minimumScore: Number(fd.get('minimumScore')),
          tieBreaker: String(fd.get('tieBreaker') ?? 'SENIORITY'),
        });
        showToast('Reglas confirmadas.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    target.querySelector<HTMLFormElement>('#competition-score-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        const candidateId = String(fd.get('candidateId') ?? '').trim();
        const result = await api.put(`/v1/competitions/${encodeURIComponent(id)}/candidates/${encodeURIComponent(candidateId)}/score`, {
          score: Number(fd.get('score')),
          reason: String(fd.get('reason') ?? 'CAPTURE'),
        });
        const pending = (result as { pendingApproval?: boolean; revisionId?: string }).pendingApproval;
        showToast(pending ? `Cambio pendiente de segundo revisor: ${(result as { revisionId?: string }).revisionId ?? ''}` : 'Calificación registrada.', pending ? 'warning' : 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    target.querySelector<HTMLButtonElement>('#competition-rank')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        await api.post(`/v1/competitions/${encodeURIComponent(id)}/rank`);
        showToast('Ranking calculado por el motor.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    target.querySelector<HTMLButtonElement>('#competition-award')?.addEventListener('click', async (event) => {
      if (!await confirmCriticalAction({ title: 'Adjudicar concurso', message: 'Confirma la adjudicación del candidato con ranking #1. La API volverá a validar reglas, revisiones, apelaciones y disponibilidad.', confirmLabel: 'Adjudicar' })) return;
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        await api.post(`/v1/competitions/${encodeURIComponent(id)}/award`);
        showToast('Concurso adjudicado.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    const revisionForm = target.querySelector<HTMLFormElement>('#score-revision-form');
    revisionForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = revisionForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const revisionId = String(new FormData(revisionForm).get('revisionId') ?? '').trim();
        await api.post(`/v1/competitions/score-revisions/${encodeURIComponent(revisionId)}/approve`);
        showToast('Revisión aprobada por segundo usuario.', 'success');
        revisionForm.reset();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
    target.querySelector<HTMLButtonElement>('#revision-reject')?.addEventListener('click', async (event) => {
      if (!revisionForm) return;
      const revisionId = String(new FormData(revisionForm).get('revisionId') ?? '').trim();
      if (!revisionId) {
        showToast('Revision ID requerido.', 'warning');
        return;
      }
      const reason = window.prompt('Motivo del rechazo');
      if (!reason?.trim()) return;
      if (!await confirmCriticalAction({ title: 'Rechazar revisión', message: 'La solicitud de cambio de calificación será rechazada y auditada.', danger: true, confirmLabel: 'Rechazar' })) return;
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        await api.post(`/v1/competitions/score-revisions/${encodeURIComponent(revisionId)}/reject`, { reason: reason.trim() });
        showToast('Revisión rechazada.', 'success');
        revisionForm.reset();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  } catch (error) {
    target.innerHTML = renderPageError(error);
  }
}
