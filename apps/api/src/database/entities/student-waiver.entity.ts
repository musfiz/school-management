/** Waiver families map 1:1 to contra-revenue GLs 41901–41904 (spec §2). */
export type WaiverType =
  | 'MERIT'
  | 'FREEDOM_FIGHTER'
  | 'SIBLING_STAFF_AID'
  | 'LILLAH_ZAKAT_ORPHAN';

export const WAIVER_TYPES: WaiverType[] = [
  'MERIT',
  'FREEDOM_FIGHTER',
  'SIBLING_STAFF_AID',
  'LILLAH_ZAKAT_ORPHAN',
];

/** Default contra GL per waiver type (overridable per row via contraGlId). */
export const WAIVER_DEFAULT_GL: Record<WaiverType, string> = {
  MERIT: '41901',
  FREEDOM_FIGHTER: '41902',
  SIBLING_STAFF_AID: '41903',
  LILLAH_ZAKAT_ORPHAN: '41904',
};
