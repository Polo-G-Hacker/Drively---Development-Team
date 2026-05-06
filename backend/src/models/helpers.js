function toId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  return Boolean(Number(value));
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseJsonField(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function buildPoint(longitude, latitude) {
  if (longitude === null || longitude === undefined || latitude === null || latitude === undefined) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [toNumber(longitude), toNumber(latitude)],
  };
}

module.exports = {
  buildPoint,
  parseJsonField,
  toBoolean,
  toId,
  toNumber,
};
