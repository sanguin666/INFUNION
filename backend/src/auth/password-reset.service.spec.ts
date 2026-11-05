import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PasswordResetService } from './password-reset.service.js';
import type { EmailMessage } from './email/email-sender.js';

function setup(isSuperadmin = false) {
  const user = { id: 'u1', email: 'admin@carmen.example', isSuperadmin, passwordHash: bcrypt.hashSync('old-password', 4) };
  const sent: EmailMessage[] = [];
  const users = {
    findByEmailForLogin: async (e: string) => (e === user.email ? { ...user } : null),
    findByIdForPasswordReset: async (id: string) => (id === user.id ? { ...user } : null),
    setPasswordHash: async (_id: string, hash: string) => {
      user.passwordHash = hash;
    },
  };
  const config = { get: (k: string) => ({ JWT_SECRET: 'test-secret', ADMIN_URL: 'https://admin.test/' })[k] };
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new PasswordResetService(
    users as never,
    jwt,
    config as never,
    { delivers: true, send: async (m: EmailMessage) => void sent.push(m) } as never,
    { record: async () => undefined } as never,
  );
  const tokenOf = () => decodeURIComponent(/token=([^"&\s]+)/.exec(sent.at(-1)!.text)![1]);
  return { service, sent, user, jwt, tokenOf };
}

describe('PasswordResetService', () => {
  it('sends a link that sets a new password once', async () => {
    const { service, sent, user, tokenOf } = setup();
    await service.requestLink('Admin@Carmen.example', undefined, undefined);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('https://admin.test/reset-password?token=');
    const token = tokenOf();
    expect(await service.check(token)).toEqual({ valid: true, minLength: 8 });
    await service.reset(token, 'brand-new-pass');
    expect(bcrypt.compareSync('brand-new-pass', user.passwordHash)).toBe(true);
    expect((await service.check(token)).valid).toBe(false);
    await expect(service.reset(token, 'another-pass')).rejects.toThrow('reset_link_invalid');
  });

  it('says nothing for an unknown address', async () => {
    const { service, sent } = setup();
    await expect(service.requestLink('nobody@x.example', 'es' as never)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('asks the superadmin for 12 characters', async () => {
    const { service, tokenOf } = setup(true);
    await service.requestLink('admin@carmen.example', undefined);
    const token = tokenOf();
    expect((await service.check(token)).minLength).toBe(12);
    await expect(service.reset(token, 'short-pass')).rejects.toThrow('password_too_short');
  });

  it('is never a sign-in token', async () => {
    const { service, jwt, tokenOf } = setup();
    await service.requestLink('admin@carmen.example', undefined);
    await expect(jwt.verifyAsync(tokenOf())).rejects.toThrow();
    expect((await service.check('not-a-token')).valid).toBe(false);
  });
});
