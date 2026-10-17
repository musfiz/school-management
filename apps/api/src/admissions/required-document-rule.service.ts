import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequiredDocumentRules } from '../generated/prisma/client';

@Injectable()
export class RequiredDocumentRuleService {
  constructor(private readonly prisma: PrismaService) {}

  /** List every rule (active + inactive) so the settings page can reactivate. */
  async listAll(): Promise<RequiredDocumentRules[]> {
    return this.prisma.requiredDocumentRules.findMany({
      orderBy: [{ classOrDeptId: 'asc' }, { documentType: 'asc' }],
    });
  }

  /** List active rules for a specific class/department (admission-time enforcement). */
  async listForClass(
    classOrDeptId: string,
  ): Promise<{ documentType: string; isOriginalRequired: boolean }[]> {
    return this.prisma.requiredDocumentRules.findMany({
      where: { classOrDeptId, isActive: true },
      orderBy: { documentType: 'asc' },
    });
  }

  /** Add or replace a required-document rule for a class/dept (re-add reactivates). */
  async upsert(dto: {
    classOrDeptId: string;
    documentType: string;
    isOriginalRequired: boolean;
  }): Promise<RequiredDocumentRules> {
    const existing = await this.prisma.requiredDocumentRules.findFirst({
      where: { classOrDeptId: dto.classOrDeptId, documentType: dto.documentType },
    });
    if (existing) {
      return this.prisma.requiredDocumentRules.update({
        where: { id: existing.id },
        data: { isOriginalRequired: dto.isOriginalRequired, isActive: true },
      });
    }
    return this.prisma.requiredDocumentRules.create({
      data: {
        classOrDeptId: dto.classOrDeptId,
        documentType: dto.documentType,
        isOriginalRequired: dto.isOriginalRequired,
      },
    });
  }

  /** Remove a required-document rule. */
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const rule = await this.prisma.requiredDocumentRules.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Required document rule #${id} not found`);
    await this.prisma.requiredDocumentRules.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Toggle active status. */
  async toggleActive(id: string): Promise<RequiredDocumentRules> {
    const rule = await this.prisma.requiredDocumentRules.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Required document rule #${id} not found`);
    return this.prisma.requiredDocumentRules.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
  }
}
