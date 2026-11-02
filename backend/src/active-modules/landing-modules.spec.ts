import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { moduleFitsPlace } from './module-places.js';

// The landing (and its ?for=worship / ?for=ngo variants) shows a module card
// only where the module is offered. Its rules live in landing/assets/modules.js;
// this test keeps them in step with module-places.ts (Seb, 2 Nov 2026), so a
// new module, or a module opened to new kinds of place, lands on the right pages.
const landing = resolve(process.cwd(), '..', 'landing');

interface LandingModules {
  onlyFor: Record<string, string[]>;
  variants: Record<string, string[]>;
  notOnGeneralPage: string[];
  noCard: string[];
}

function landingRules(): LandingModules {
  const js = readFileSync(resolve(landing, 'assets/modules.js'), 'utf8');
  const m = /\/\* BEGIN MODULES \*\/([\s\S]*)\/\* END MODULES \*\//.exec(js);
  if (!m) throw new Error('BEGIN/END MODULES markers missing in landing/assets/modules.js');
  return JSON.parse(m[1]) as LandingModules;
}

function landingFits(rules: LandingModules, type: ModuleType, place: PoiType): boolean {
  const only = rules.onlyFor[type];
  return !only || only.includes(place);
}

describe('landing module cards', () => {
  const rules = landingRules();
  const html = readFileSync(resolve(landing, 'index.html'), 'utf8');
  const cards = [...html.matchAll(/data-module="([a-z_]+)"/g)].map((m) => m[1]);
  const modules = Object.values(ModuleType) as string[];
  const places = Object.values(PoiType) as string[];

  it('offers each module to the same kinds of place as the app', () => {
    for (const type of Object.values(ModuleType)) {
      for (const place of Object.values(PoiType)) {
        expect([type, place, landingFits(rules, type, place)]).toEqual([
          type,
          place,
          moduleFitsPlace(type, place),
        ]);
      }
    }
  });

  it('names only real modules and kinds of place', () => {
    for (const type of [...Object.keys(rules.onlyFor), ...rules.notOnGeneralPage, ...rules.noCard, ...cards]) {
      expect(modules).toContain(type);
    }
    for (const place of [...Object.values(rules.onlyFor).flat(), ...Object.values(rules.variants).flat()]) {
      expect(places).toContain(place);
    }
  });

  it('has one card for every module, unless it is listed as having none', () => {
    for (const type of modules) {
      const count = cards.filter((c) => c === type).length;
      expect([type, count]).toEqual([type, rules.noCard.includes(type) ? 0 : 1]);
    }
  });
});
