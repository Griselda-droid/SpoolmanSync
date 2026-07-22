export interface KValuePreset {
  nickname: string;
  value: number;
}

const K_VALUE_PATTERN = /(?:^|\s)k_value\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+))(?:\s|$)/i;

export function parseKValue(comment: string | null | undefined): number | undefined {
  const match = (comment || '').match(K_VALUE_PATTERN);
  if (!match) return undefined;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function formatCommentWithKValue(
  comment: string | null | undefined,
  kValue: number | undefined,
): string | undefined {
  const baseComment = (comment || '')
    .replace(K_VALUE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (kValue === undefined || !Number.isFinite(kValue)) {
    return baseComment || undefined;
  }

  return `${baseComment}${baseComment ? ' ' : ''}k_value=${kValue}`;
}

export function normalizeKValuePresets(value: unknown): KValuePreset[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): KValuePreset | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const nickname = typeof record.nickname === 'string' ? record.nickname.trim() : '';
      const numericValue = typeof record.value === 'number' ? record.value : Number(record.value);
      if (!nickname || !Number.isFinite(numericValue)) return null;
      return { nickname, value: numericValue };
    })
    .filter((item): item is KValuePreset => item !== null);
}
