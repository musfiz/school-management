import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';

/** Which part of the site a menu item belongs to. Extend as new menu
 *  surfaces are added (e.g. 'footer', 'dashboard_sidebar'). */
export type MenuLocation = 'header';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({
    name: 'menu_location',
    type: 'varchar',
    length: 30,
    default: 'header',
  })
  menuLocation!: MenuLocation;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId?: number | null;

  @ManyToOne(() => MenuItem, (item) => item.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: MenuItem | null;

  @OneToMany(() => MenuItem, (item) => item.parent)
  children?: MenuItem[];

  @Column({ name: 'label_en', type: 'varchar', length: 150 })
  labelEn!: string;

  @Column({ name: 'label_bn', type: 'varchar', length: 150, nullable: true })
  labelBn?: string | null;

  @Column({ name: 'href', type: 'varchar', length: 255 })
  href!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
