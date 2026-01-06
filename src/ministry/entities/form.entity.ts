import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from "typeorm";

export enum FormStatus {
  DRAFT = "DRAFT",
  SUBMITTED_TO_MOSPI_REVIEWER = "SUBMITTED_TO_MOSPI_REVIEWER",
  SUBMITTED_TO_MOSPI_APPROVER = "SUBMITTED_TO_MOSPI_APPROVER",
  RETURNED_FROM_MOSPI = "RETURNED_FROM_MOSPI",
  ACCEPTED_BY_MOSPI = "ACCEPTED_BY_MOSPI",
}

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

  @Column({
    name: "status",
    type: "enum",
    enum: FormStatus,
    // default: FormStatus.DRAFT,
    nullable: true,
  })
  status: FormStatus | null;
  
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

