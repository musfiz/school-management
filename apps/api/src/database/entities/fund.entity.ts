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
