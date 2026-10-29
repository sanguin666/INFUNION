import { ModuleType } from '../common/enums/module-type.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';

const WORSHIP: readonly PoiType[] = [
  PoiType.CHURCH,
  PoiType.MOSQUE,
  PoiType.SYNAGOGUE,
  PoiType.OTHER_WORSHIP,
];

// Modules that only make sense for some kinds of place (Seb, 29 Oct 2026).
// Every module not listed here is offered to every place. A module that
// does not fit is hidden, never deleted: a row saved before stays in the
// database, but no list, menu or bill sees it.
const ONLY_FOR: Partial<Record<ModuleType, readonly PoiType[]>> = {
  [ModuleType.MASS_INTENTIONS]: [PoiType.CHURCH],
  [ModuleType.PRAYER_REQUESTS]: WORSHIP,
  [ModuleType.DAILY_READINGS]: WORSHIP,
};

export function moduleFitsPlace(type: ModuleType, place: PoiType): boolean {
  const only = ONLY_FOR[type];
  return !only || only.includes(place);
}

/** Every module a place of this kind can be offered, in enum order. */
export function modulesForPlace(place: PoiType): ModuleType[] {
  return Object.values(ModuleType).filter((type) => moduleFitsPlace(type, place));
}
