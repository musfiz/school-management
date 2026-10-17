/** Institution types for cost centers. */
export const INSTITUTION_TYPES = ['SCHOOL', 'COLLEGE', 'MADRASAH', 'UNIVERSITY'] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

/** Cost center row (wire shape — mirrors Prisma `CostCenters`). */
export interface CostCenter {
  id: string;
  centerCode: string;
  centerName: string;
  institutionType: string;
  parentId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Fund row (wire shape — mirrors Prisma `Funds`). */
export interface Fund {
  id: string;
  fundCode: string;
  fundName: string;
  isRestricted: boolean;
  shariahCompliant: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
