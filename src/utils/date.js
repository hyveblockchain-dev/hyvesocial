export function parseDateValue(value) {
  if (!value) return null;

  if (typeof value === 'object') {
    if (value.$date !== undefined) {
      const rawDate = value.$date;
      if (rawDate && typeof rawDate === 'object') {
        const longValue = rawDate.$numberLong ?? rawDate.$numberInt;
        if (longValue !== undefined) {
          return parseDateValue(longValue);
        }
      }
      return parseDateValue(rawDate);
    }

    if (value.date !== undefined) {
      return parseDateValue(value.date);
    }

    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }

    const seconds =
      value.seconds ??
      value._seconds ??
      value.secs ??
      value.epochSeconds ??
      value.epoch_seconds;
    const nanos = value.nanoseconds ?? value._nanoseconds ?? value.nanos;

    if (typeof seconds === 'number') {
      const ms = seconds * 1000 + (typeof nanos === 'number' ? Math.floor(nanos / 1e6) : 0);
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

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

    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) return direct;

    let normalized = trimmed.replace(' ', 'T');

    normalized = normalized.replace(/\.(\d{3})\d+/, '.$1');

    normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');

    normalized = normalized.replace(/\s*(UTC|GMT)$/i, 'Z');

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
