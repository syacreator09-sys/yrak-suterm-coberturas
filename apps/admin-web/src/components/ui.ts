import { escapeText } from '../core/security.js';
import type { IntegrationHealth } from '../core/types.js';

export function renderBadge(label: unknown, tone: 'neutral'|'success'|'warning'|'danger'|'info' = 'neutral'): string {
  return `<span class="badge badge-${tone}">${escapeText(label)}</span>`;
}

export function healthTone(status: IntegrationHealth): 'neutral'|'success'|'warning'|'danger'|'info' {
  switch (status) {
    case 'healthy': return 'success';
    case 'degraded': return 'warning';
    case 'down': return 'danger';
    case 'not_configured': return 'neutral';
    default: return 'info';
  }
}

export function renderHealth(status: IntegrationHealth): string {
  const labels: Record<IntegrationHealth, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    down: 'Down',
    not_configured: 'No configurado',
    unknown: 'Sin verificar',
  };
  return renderBadge(labels[status], healthTone(status));
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '<span class="muted">—</span>';
  if (typeof value === 'boolean') return renderBadge(value ? 'Sí' : 'No', value ? 'success' : 'neutral');
  if (typeof value === 'object') return `<code class="inline-code">${escapeText(value)}</code>`;
  const text = String(value);
  const normalized = text.toUpperCase();
  if (['ACTIVE','AVAILABLE','COMPLIANT','APPROVED','SCHEDULED','COMPLETED','AWARDED','READY','SENT'].includes(normalized)) {
    return renderBadge(text, 'success');
  }
  if (['PENDING','PENDING_INFORMATION','PENDING_VALIDATION','PENDING_APPROVAL','UNDER_REVIEW','PROPOSED'].includes(normalized)) {
    return renderBadge(text, 'warning');
  }
  if (['FAILED','REJECTED','CANCELLED','EXPIRED','MISSING','BLOCKED'].includes(normalized)) {
    return renderBadge(text, 'danger');
  }
  return escapeText(text);
}

export function renderTable<T extends Record<string, unknown>>(
  items: readonly T[],
  columns: readonly { key: keyof T | string; label: string }[],
  options: { empty?: string } = {},
): string {
  if (!items.length) return renderEmpty(options.empty ?? 'Sin registros.');
  const header = columns.map((column) => `<th scope="col">${escapeText(column.label)}</th>`).join('');
  const rows = items.map((item) => `<tr>${columns.map((column) => {
    const key = String(column.key);
    return `<td>${formatCell(item[key])}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderEmpty(message: string): string {
  return `<div class="empty-state"><div class="empty-icon">○</div><p>${escapeText(message)}</p></div>`;
}

export function renderAlert(message: unknown, tone: 'info'|'success'|'warning'|'danger' = 'info', correlationId?: string): string {
  return `<div class="alert alert-${tone}"><div>${escapeText(message)}</div>${correlationId ? `<small>Correlation ID: ${escapeText(correlationId)}</small>` : ''}</div>`;
}

export function renderLoading(label = 'Cargando…'): string {
  return `<div class="loading-state"><span class="spinner" aria-hidden="true"></span><span>${escapeText(label)}</span></div>`;
}

export function renderJson(value: unknown): string {
  return `<pre class="json-viewer">${escapeText(JSON.stringify(value, null, 2))}</pre>`;
}

export function renderStat(label: string, value: unknown, detail?: string): string {
  return `<article class="stat-card"><span class="stat-label">${escapeText(label)}</span><strong class="stat-value">${escapeText(value)}</strong>${detail ? `<span class="stat-detail">${escapeText(detail)}</span>` : ''}</article>`;
}

export function renderField(label: string, control: string, hint?: string): string {
  return `<label class="field"><span class="field-label">${escapeText(label)}</span>${control}${hint ? `<small class="field-hint">${escapeText(hint)}</small>` : ''}</label>`;
}

export function formDataObject(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value)]));
}

export function requiredString(value: FormDataEntryValue | null, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label}_REQUIRED`);
  return text;
}

export async function withBusy<T>(button: HTMLButtonElement, operation: () => Promise<T>): Promise<T> {
  if (button.disabled) throw new Error('ACTION_ALREADY_IN_PROGRESS');
  const original = button.textContent;
  button.disabled = true;
  button.dataset.busy = 'true';
  button.textContent = 'Procesando…';
  try {
    return await operation();
  } finally {
    button.disabled = false;
    delete button.dataset.busy;
    button.textContent = original;
  }
}

export async function confirmCriticalAction(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `<form method="dialog"><h3>${escapeText(options.title)}</h3><p>${escapeText(options.message)}</p><div class="dialog-actions"><button value="cancel" class="secondary">Cancelar</button><button value="confirm" class="${options.danger ? 'danger' : 'primary'}">${escapeText(options.confirmLabel ?? 'Confirmar')}</button></div></form>`;
  document.body.append(dialog);
  if (typeof dialog.showModal !== 'function') {
    dialog.remove();
    return window.confirm(`${options.title}\n\n${options.message}`);
  }
  return await new Promise<boolean>((resolve) => {
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirm';
      dialog.remove();
      resolve(confirmed);
    }, { once: true });
    dialog.showModal();
  });
}

export function showToast(message: unknown, tone: 'info'|'success'|'warning'|'danger' = 'info'): void {
  let region = document.querySelector<HTMLDivElement>('#toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.textContent = String(message);
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4500);
}
