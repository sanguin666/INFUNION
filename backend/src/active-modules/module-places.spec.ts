import { ModuleType } from '../common/enums/module-type.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { moduleFitsPlace, modulesForPlace } from './module-places.js';

describe('module places', () => {
  it('keeps Mass intentions for churches', () => {
    expect(moduleFitsPlace(ModuleType.MASS_INTENTIONS, PoiType.CHURCH)).toBe(true);
    expect(moduleFitsPlace(ModuleType.MASS_INTENTIONS, PoiType.MOSQUE)).toBe(false);
    expect(moduleFitsPlace(ModuleType.MASS_INTENTIONS, PoiType.ASSOCIATION)).toBe(false);
  });

  it('keeps prayer requests and daily readings for places of worship', () => {
    for (const type of [ModuleType.PRAYER_REQUESTS, ModuleType.DAILY_READINGS]) {
      expect(moduleFitsPlace(type, PoiType.SYNAGOGUE)).toBe(true);
      expect(moduleFitsPlace(type, PoiType.OTHER_WORSHIP)).toBe(true);
      expect(moduleFitsPlace(type, PoiType.ASSOCIATION)).toBe(false);
      expect(moduleFitsPlace(type, PoiType.CULTURE)).toBe(false);
    }
  });

  it('offers the general modules everywhere', () => {
    expect(modulesForPlace(PoiType.ASSOCIATION)).toEqual([
      ModuleType.DONATIONS,
      ModuleType.EVENTS,
      ModuleType.ANNOUNCEMENTS,
      ModuleType.LIVESTREAMS,
      ModuleType.COMMUNITY,
      ModuleType.REQUESTS,
      ModuleType.MESSAGES,
    ]);
    expect(modulesForPlace(PoiType.CHURCH)).toEqual(Object.values(ModuleType));
  });
});
