import { describe, expect, it } from 'vitest';
import { formatCommentWithKValue, normalizeKValuePresets, parseKValue } from './k-value';

describe('K value helpers', () => {
  it('appends and replaces the k_value comment token', () => {
    expect(formatCommentWithKValue('测试备注', 0.1234)).toBe('测试备注 k_value=0.1234');
    expect(formatCommentWithKValue('测试备注 k_value=0.1', 0.2)).toBe('测试备注 k_value=0.2');
  });

  it('parses and removes a k_value token', () => {
    expect(parseKValue('PLA k_value=0.08')).toBe(0.08);
    expect(formatCommentWithKValue('PLA k_value=0.08', undefined)).toBe('PLA');
  });

  it('normalizes configured presets', () => {
    expect(normalizeKValuePresets([
      { nickname: 'PLA', value: '0.12' },
      { nickname: '', value: 0.2 },
      { nickname: 'PETG', value: 'invalid' },
    ])).toEqual([{ nickname: 'PLA', value: 0.12 }]);
  });
});
