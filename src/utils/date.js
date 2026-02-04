export function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && String(numeric) === trimmed) {
      const ms = numeric < 1e12 ? numeric * 1000 : numeric;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date;

    const normalized = trimmed.replace(' ', 'T');
    const normalizedDate = new Date(normalized);
    return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate;
  }

  return null;
}

export function formatDate(value, options, fallback = '') {
  const date = parseDateValue(value);
  if (!date) return fallback;
  return date.toLocaleDateString(undefined, options);
}

export function formatDateTime(value, options, fallback = '') {
  const date = parseDateValue(value);
  if (!date) return fallback;
  return date.toLocaleString(undefined, options);
}

export function formatTime(value, options, fallback = '') {
  const date = parseDateValue(value);
  if (!date) return fallback;
  return date.toLocaleTimeString(undefined, options);
}
