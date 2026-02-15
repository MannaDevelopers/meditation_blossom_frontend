import logger from './logger';

const normalizeValueForSignature = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.replace(/\r\n/g, '\n');
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValueForSignature);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValueForSignature((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
};

export const normalizeJsonString = (jsonString: string | null | undefined): string => {
  try {
    if (!jsonString) {
      return '';
    }
    const parsed: unknown = JSON.parse(jsonString);
    const sorted = normalizeValueForSignature(parsed);
    return JSON.stringify(sorted);
  } catch (error) {
    logger.error('Failed to normalize JSON string:', error);
    return '';
  }
};
