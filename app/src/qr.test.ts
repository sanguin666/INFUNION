import { describe, expect, it } from 'vitest';
import { extractPoiToken } from './qr';

describe('extractPoiToken', () => {
  it('reads the token out of the link a flyer encodes', () => {
    expect(extractPoiToken('https://infunion.app/?token=DEMO-STMARYS#join')).toBe('DEMO-STMARYS');
    expect(
      extractPoiToken('https://infunion.app/?token=8f14e45f-ceea-467a-9ba3-1a1b2c3d4e5f#join'),
    ).toBe('8f14e45f-ceea-467a-9ba3-1a1b2c3d4e5f');
  });

  it('handles the token sitting among other query parameters', () => {
    expect(extractPoiToken('https://infunion.app/?utm=flyer&token=DEMO-STMARYS')).toBe(
      'DEMO-STMARYS',
    );
    expect(extractPoiToken('https://infunion.app/?token=DEMO-STMARYS&utm=flyer')).toBe(
      'DEMO-STMARYS',
    );
  });

  it('decodes an escaped token', () => {
    expect(extractPoiToken('https://infunion.app/?token=DEMO%2DSTMARYS#join')).toBe('DEMO-STMARYS');
  });

  it('accepts a bare token, which is what gets typed in by hand', () => {
    expect(extractPoiToken('DEMO-STMARYS')).toBe('DEMO-STMARYS');
    expect(extractPoiToken('  DEMO-STMARYS  ')).toBe('DEMO-STMARYS');
  });

  it("rejects QR codes that aren't ours", () => {
    // A website with no token, a payment code, a wifi code, free text.
    expect(extractPoiToken('https://example.com/some/page')).toBeNull();
    expect(extractPoiToken('WIFI:S:ParishGuest;T:WPA;P:secret;;')).toBeNull();
    expect(extractPoiToken('Come to the 10am mass!')).toBeNull();
    expect(extractPoiToken('')).toBeNull();
    expect(extractPoiToken('   ')).toBeNull();
  });

  it('ignores a token in the fragment rather than the query', () => {
    // '#' ends the query, so this carries no token to find.
    expect(extractPoiToken('https://infunion.app/#token=DEMO-STMARYS')).toBeNull();
  });

  it('is not fooled by a parameter whose name merely ends in token', () => {
    expect(extractPoiToken('https://infunion.app/?other_token=DEMO-STMARYS')).toBeNull();
  });
});
