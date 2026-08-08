export type IconName =
  | 'calendar'
  | 'clock'
  | 'flag'
  | 'alert'
  | 'users'
  | 'activity'
  | 'agent'
  | 'model'
  | 'cloud'
  | 'database'
  | 'bolt'
  | 'mail'
  | 'search';

const paths: Record<IconName, string> = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4m0 1h10l-1.5 3L15 11H5"/>',
  alert: '<path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  activity: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  agent: '<rect x="5" y="7" width="14" height="12" rx="4"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>',
  model: '<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5"/>',
  cloud: '<path d="M17.5 19H6a4 4 0 0 1-.6-7.95A6 6 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 19Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};

export function icon(name: IconName, className = 'ui-icon'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
