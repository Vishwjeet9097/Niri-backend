import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from "typeorm";

@Entity("ministry_form")
export class Form {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "integer", nullable: true })
  year: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  ministry: string;

  @Column({ name: "reviewer", type: "varchar", length: 255, nullable: true })
  reviewer: string;

  @Column({ name: "ministry_user", type: "varchar", length: 255, nullable: true })
  ministryUser: string;
  
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

