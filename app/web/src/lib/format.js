export function cx(...args) {
  return args.filter(Boolean).join(' ');
}

export function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms);
      return future ? `in ${n} ${unit}${n > 1 ? 's' : ''}` : `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
  }
  return future ? 'in a moment' : 'just now';
}

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', ...opts,
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function clockTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.toLocaleTimeString('en-GB', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function duration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

export function bytes(value, digits = 1) {
  const n = Number(value || 0);
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? digits : 0)} ${units[i]}`;
}

export function num(value) {
  return Number(value || 0).toLocaleString('en-GB');
}

export function shortSha(sha) {
  return sha ? sha.slice(0, 7) : '—';
}

export function initials(name) {
  return String(name || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export const STATUS_TONE = {
  ready: 'success',
  active: 'success',
  healthy: 'success',
  connected: 'success',
  running: 'success',
  operational: 'success',
  building: 'info',
  deploying: 'info',
  verifying: 'info',
  queued: 'neutral',
  pending: 'warn',
  restarting: 'warn',
  degraded: 'warn',
  disconnected: 'neutral',
  paused: 'neutral',
  stopped: 'neutral',
  exited: 'neutral',
  cancelled: 'neutral',
  failed: 'danger',
  error: 'danger',
  past_due: 'danger',
};

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
  return Promise.resolve();
}
