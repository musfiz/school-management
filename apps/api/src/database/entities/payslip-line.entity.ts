import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayrollRun } from './payroll-run.entity';

/**
 * One employee's payslip inside a run (Phase 6).
 * `netInstitutionalPayable` = institutionalGross − pfEmployee − aitTds
 * − loan. `mpoGovtAmount` rides along for the payslip printout and is
 * excluded from every journal leg by construction (approve posts only
 * the institutional columns).
 */
@Entity('payslip_lines')
export class PayslipLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'run_id', type: 'char', length: '36' })
  runId!: string;

  @ManyToOne(() => PayrollRun, (r) => r.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: PayrollRun;

  /** Staff UUID for the 11403/21102 EMPLOYEE sub-ledgers (HR phase fills this). */
  @Column({ name: 'employee_id', type: 'char', length: '36', nullable: true })
  employeeId!: string | null;

  /** Snapshot name printed on the payslip. */
  @Column({ name: 'employee_name', type: 'varchar', length: 150 })
  employeeName!: string;

  @Column({ name: 'designation', type: 'varchar', length: 120, nullable: true })
  designation!: string | null;

  @Column({ name: 'mpo_govt_amount', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  mpoGovtAmount!: string;

  @Column({ name: 'institutional_gross_amount', type: 'decimal', precision: 15, scale: 2 })
  institutionalGrossAmount!: string;

  @Column({ name: 'pf_employee_deduction', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  pfEmployeeDeduction!: string;

  @Column({ name: 'pf_employer_contribution', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  pfEmployerContribution!: string;

  @Column({ name: 'ait_tds_deduction', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  aitTdsDeduction!: string;

  @Column({ name: 'loan_deduction', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  loanDeduction!: string;

  @Column({ name: 'net_institutional_payable', type: 'decimal', precision: 15, scale: 2 })
  netInstitutionalPayable!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
