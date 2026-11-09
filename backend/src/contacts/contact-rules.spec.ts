import { cleanPhone, cleanRow, phoneKey, planFile, cleanLanguage, cleanTelegram, cleanGroups } from './contact-rules.js';

describe('contact rules', () => {
  it('writes Spanish phones with their country code', () => {
    expect(cleanPhone('612 34 56 78')).toBe('+34612345678');
    expect(cleanPhone('0034 612 345 678')).toBe('+34612345678');
    expect(cleanPhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(cleanPhone('')).toBeNull();
  });

  it('recognises one phone however it is written', () => {
    expect(phoneKey('+34612345678')).toBe(phoneKey('612345678'));
    expect(phoneKey('123')).toBeNull();
  });

  it('keeps a row with a valid email or phone, and says why it drops the others', () => {
    expect(cleanRow({ firstName: 'María', email: ' Maria@Gmail.com ' }).contact.email).toBe('maria@gmail.com');
    expect(cleanRow({ firstName: 'Pepe', email: 'pepe@gmail' }).problem).toBe('badEmail');
    expect(cleanRow({ firstName: 'Pepe', phone: '612 34' }).problem).toBe('badPhone');
    expect(cleanRow({ firstName: 'Pepe' }).problem).toBe('unreachable');
    expect(cleanRow({ firstName: 'Pepe', telegram: 't.me/pepe' }).problem).toBeNull();
  });

  it('merges the rows of one person in a file', () => {
    const plan = planFile([
      { firstName: 'María', email: 'maria@gmail.com', groups: 'Coro' },
      { firstName: 'María', lastName: 'García', phone: '612345678', email: 'MARIA@gmail.com', groups: 'Catequesis' },
      { firstName: 'José', phone: '+34 698 112 233' },
      { firstName: 'José M.', phone: '698112233' },
      {},
      { firstName: 'Nadie' },
    ]);
    expect(plan.people).toHaveLength(2);
    expect(plan.people[0].contact).toMatchObject({ lastName: 'García', phone: '+34612345678', groups: ['Coro', 'Catequesis'] });
    expect(plan.people[0].rows).toEqual([1, 2]);
    expect(plan.people[1].rows).toEqual([3, 4]);
    expect(plan.problems).toEqual([{ row: 6, problem: 'unreachable', name: 'Nadie' }]);
  });

  it('reads languages, Telegram handles and groups in the ways people write them', () => {
    expect(cleanLanguage('Castellano')).toBe('es');
    expect(cleanLanguage('FR')).toBe('fr');
    expect(cleanLanguage('Klingon')).toBeNull();
    expect(cleanTelegram('https://t.me/luciaf')).toBe('@luciaf');
    expect(cleanGroups('Coro; coro, Jóvenes')).toEqual(['Coro', 'Jóvenes']);
  });
});
