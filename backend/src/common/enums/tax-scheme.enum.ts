/**
 * What a gift to this community is worth on the giver's tax return. It is
 * the community's own legal status, so only its admin can say it, and it
 * decides three things: the receipt's legal wording, the "what it really
 * costs you" line on the app's gift form, and the modelo 182 file.
 *
 * NONE is the default: an ordinary association's gifts give no deduction,
 * and a receipt that cites the Ley 49/2002 for one would be wrong.
 */
export enum TaxScheme {
  NONE = 'none',
  // Spain, an entity under Title III of the Ley 49/2002 (foundations and
  // public-utility associations that opted in, the Church and the other
  // faiths with an agreement): 80 % on a giver's first 250 € of the year,
  // 40 % above, 45 % when they give again for a third year.
  ES_LEY49 = 'es_ley49',
  // Spain, a foundation or public-utility association outside that
  // regime: 10 % (Ley 35/2006, art. 68.3.b).
  ES_ART68 = 'es_art68',
}
