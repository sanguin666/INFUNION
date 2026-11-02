// Which kinds of place each module is offered to, for the module cards of
// the landing and its variants (?for=worship, ?for=ngo). It mirrors
// backend/src/active-modules/module-places.ts: the backend test
// landing-modules.spec.ts fails when the two drift apart, so a module added
// or opened to new kinds of place shows on the right pages.
window.INFUNION_MODULES = /* BEGIN MODULES */ {
  "onlyFor": {
    "mass_intentions": ["church"],
    "prayer_requests": ["church", "mosque", "synagogue", "other_worship"],
    "daily_readings": ["church", "mosque", "synagogue", "other_worship"]
  },
  "variants": {
    "worship": ["church", "mosque", "synagogue", "other_worship"],
    "ngo": ["association"]
  },
  "notOnGeneralPage": ["mass_intentions"],
  "noCard": ["messages"]
} /* END MODULES */;
