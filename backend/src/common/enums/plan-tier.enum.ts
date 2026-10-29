/**
 * The three plans a community can be on (Seb, 29 Oct 2026), smallest
 * first. They replaced the per-module prices: a plan opens a set of
 * modules, and the community shows or hides each one at no cost.
 */
export enum PlanTier {
  BASIC = 'basic',
  ESSENTIALS = 'essentials',
  COMPLETE = 'complete',
}
