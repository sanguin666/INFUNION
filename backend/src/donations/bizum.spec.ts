import { describe, expect, it } from 'vitest';
import { formatBizumPhone, newBizumCode, normalizeBizumPhone } from './bizum.js';

describe('Bizum by number', () => {
  it('takes a Spanish mobile number in the usual spellings', () => {
    expect(normalizeBizumPhone('600 123 456')).toBe('600123456');
    expect(normalizeBizumPhone('+34 712-345-678')).toBe('712345678');
    expect(normalizeBizumPhone('0034600123456')).toBe('600123456');
  });

  it('refuses what Bizum cannot take', () => {
    expect(normalizeBizumPhone('912 345 678')).toBeNull();
    expect(normalizeBizumPhone('60012345')).toBeNull();
    expect(normalizeBizumPhone('hello')).toBeNull();
  });

  it('formats and makes concepts', () => {
    expect(formatBizumPhone('600123456')).toBe('600 123 456');
    expect(newBizumCode(() => 0)).toBe('INF 1000');
    expect(newBizumCode(() => 0.9999)).toBe('INF 9999');
  });
});
