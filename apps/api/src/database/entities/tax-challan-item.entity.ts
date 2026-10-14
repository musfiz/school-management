import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaxChallan } from './tax-challan.entity';
import { VendorBill } from './vendor-bill.entity';

export type WithheldTaxType = 'TDS' | 'VDS';

export const WITHHELD_TAX_TYPES: WithheldTaxType[] = ['TDS', 'VDS'];

/** One withheld-tax leg deposited under a Treasury challan. */
@Entity('tax_challan_items')
export class TaxChallanItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'challan_id', type: 'char', length: '36' })
  challanId!: string;

  @ManyToOne(() => TaxChallan, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan!: TaxChallan;

  @Column({ name: 'vendor_bill_id', type: 'char', length: '36' })
  vendorBillId!: string;

  @ManyToOne(() => VendorBill, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendor_bill_id' })
  vendorBill!: VendorBill;

  @Column({ name: 'tax_type', type: 'varchar', length: 10 })
  taxType!: WithheldTaxType;

  @Column({ name: 'amount', type: 'decimal', precision: 15, scale: 2 })
  amount!: string;
}
