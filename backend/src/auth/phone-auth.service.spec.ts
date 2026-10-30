import { PhoneAuthService, isEmailLogin, normalizeEmail, normalizePhone } from './phone-auth.service.js';

/**
 * Normalization decides whether two spellings of a number reach the same
 * account, so it is worth pinning down on its own. The rest of the login —
 * expiry, one-shot codes, throttling — needs a database to mean anything
 * and is covered in test/auth.e2e-spec.ts.
 */
describe('normalizePhone', () => {
  it('strips the punctuation people type', () => {
    expect(normalizePhone('+34 600 11 22 33')).toBe('+34600112233');
    expect(normalizePhone('+34-600-112-233')).toBe('+34600112233');
    expect(normalizePhone('+34 (600) 112.233')).toBe('+34600112233');
    expect(normalizePhone('  +34600112233  ')).toBe('+34600112233');
  });

  it('keeps a leading + and only a leading +', () => {
    expect(normalizePhone('+34600112233')).toBe('+34600112233');
    expect(normalizePhone('600112233')).toBe('600112233');
    expect(normalizePhone('00 34 600 112 233')).toBe('0034600112233');
  });

  it('treats a national and an international spelling as different', () => {
    // Known limitation, documented on the function: resolving one to the
    // other needs a country, and there's no country picker yet.
    expect(normalizePhone('600112233')).not.toBe(normalizePhone('+34600112233'));
  });
});

describe('email sign-in', () => {
  it('tells an email from a phone number by the @', () => {
    expect(isEmailLogin('ana@example.com')).toBe(true);
    expect(isEmailLogin('+34 600 11 22 33')).toBe(false);
  });

  it('reaches the same account whatever the case or spaces', () => {
    expect(normalizeEmail('  Ana.Garcia@Example.COM ')).toBe('ana.garcia@example.com');
  });
});

/**
 * The one-tap demo sign-in: on by default in development, off in
 * production, and DEMO_LOGIN overrides either way so the hosted demo server
 * can keep it.
 */
describe('PhoneAuthService.demoLoginEnabled', () => {
  function service(env: Record<string, string>, delivers = false) {
    const config = { get: (key: string, fallback?: string) => env[key] ?? fallback };
    return new PhoneAuthService(
      null as never,
      null as never,
      null as never,
      { delivers } as never,
      config as never,
      { delivers: false } as never,
    );
  }

  it('is on in development and off in production', () => {
    expect(service({}).demoLoginEnabled()).toBe(true);
    expect(service({ NODE_ENV: 'production' }).demoLoginEnabled()).toBe(false);
  });

  it('stays on in production with DEMO_LOGIN=on', () => {
    expect(service({ NODE_ENV: 'production', DEMO_LOGIN: 'on' }).demoLoginEnabled()).toBe(true);
  });

  it('is off with DEMO_LOGIN=off, or once real texts are sent', () => {
    expect(service({ DEMO_LOGIN: 'off' }).demoLoginEnabled()).toBe(false);
    expect(service({ NODE_ENV: 'production', DEMO_LOGIN: 'on' }, true).demoLoginEnabled()).toBe(false);
  });
});
