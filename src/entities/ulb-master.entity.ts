import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UlbStatus {
  INACTIVE = 0,
  ACTIVE = 1,
}

@Entity('ulb_masters')
export class UlbMaster {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: 'varchar', length: 255 })
  state_name: string;

  @Column({ type: 'varchar', length: 255 })
  city_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ulb_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ulb_type: string;

  @Column({
    type: 'enum',
    enum: UlbStatus,
    default: UlbStatus.ACTIVE,
  })
  status: UlbStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
