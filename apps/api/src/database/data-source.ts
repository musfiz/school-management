import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './entities/user.entity';
import { MenuItem } from './entities/menu-item.entity';
import { SiteSetting } from './entities/site-setting.entity';
import { Page } from './entities/page.entity';
import { GoverningBodyMember } from './entities/governing-body-member.entity';
import { ExPrincipal } from './entities/ex-principal.entity';
import { Slider } from './entities/slider.entity';
import { StaffMember } from './entities/staff-member.entity';
import { Teacher } from './entities/teacher.entity';
import { Permission } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { Module } from './entities/module.entity';
import { HeroSection } from './entities/hero-section.entity';
import { Notice } from './entities/notice.entity';
import { Fund } from './entities/fund.entity';
import { CostCenter } from './entities/cost-center.entity';
import { ChartOfAccount } from './entities/chart-of-account.entity';
import { FiscalPeriod } from './entities/fiscal-period.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { VoucherSequence } from './entities/voucher-sequence.entity';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'school',
  entities: [User, MenuItem, SiteSetting, Page, GoverningBodyMember, ExPrincipal, Slider, StaffMember, Teacher, Permission, UserPermission, Module, HeroSection, Notice, Fund, CostCenter, ChartOfAccount, FiscalPeriod, JournalEntry, JournalLine, VoucherSequence],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
