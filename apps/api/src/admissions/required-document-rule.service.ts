import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequiredDocumentRule } from '../database/entities/required-document-rule.entity';

@Injectable()
export class RequiredDocumentRuleService {
  constructor(
    @InjectRepository(RequiredDocumentRule) private readonly repo: Repository<RequiredDocumentRule>,
  ) {}

  /** List every rule (active + inactive) so the settings page can reactivate. */
  async listAll(): Promise<RequiredDocumentRule[]> {
    return this.repo.find({ order: { classOrDeptId: 'ASC', documentType: 'ASC' } });
  }

  /** List active rules for a specific class/department (admission-time enforcement). */
  async listForClass(classOrDeptId: string): Promise<{ documentType: string; isOriginalRequired: boolean }[]> {
    return this.repo.find({ where: { classOrDeptId, isActive: true }, order: { documentType: 'ASC' } });
  }

  /** Add or replace a required-document rule for a class/dept (re-add reactivates). */
  async upsert(dto: { classOrDeptId: string; documentType: string; isOriginalRequired: boolean }): Promise<RequiredDocumentRule> {
    const existing = await this.repo.findOne({ where: { classOrDeptId: dto.classOrDeptId, documentType: dto.documentType } });
    if (existing) {
      existing.isOriginalRequired = dto.isOriginalRequired;
      existing.isActive = true;
      return this.repo.save(existing);
    }
    const rule = this.repo.create({
      classOrDeptId: dto.classOrDeptId,
      documentType: dto.documentType,
      isOriginalRequired: dto.isOriginalRequired,
    });
    return this.repo.save(rule);
  }

  /** Remove a required-document rule. */
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const rule = await this.repo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Required document rule #${id} not found`);
    await this.repo.remove(rule);
    return { id, deleted: true };
  }

  /** Toggle active status. */
  async toggleActive(id: string): Promise<RequiredDocumentRule> {
    const rule = await this.repo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Required document rule #${id} not found`);
    rule.isActive = !rule.isActive;
    return this.repo.save(rule);
  }
}