/**
 * The kind of place. Drives the colour and symbol it gets on the map of
 * communities (Seb, 18 Oct 2026) and, in the app, the accent of its pages.
 * New values go at the end: Postgres can only append to an enum.
 */
export enum PoiType {
  CHURCH = 'church',
  MOSQUE = 'mosque',
  SYNAGOGUE = 'synagogue',
  // Any other place of worship: temple, gurdwara, Kingdom Hall…
  OTHER_WORSHIP = 'other_worship',
  ASSOCIATION = 'association',
  // Choirs, clubs, cultural centres, sports.
  CULTURE = 'culture',
}
