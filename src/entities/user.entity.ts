import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";

export enum UserRole {
  NODAL_OFFICER = "NODAL_OFFICER",
  STATE_APPROVER = "STATE_APPROVER",
  MOSPI_REVIEWER = "MOSPI_REVIEWER",
  MOSPI_APPROVER = "MOSPI_APPROVER",
  ADMIN = "ADMIN",
  MINISTRY_APPROVER = "MINISTRY_APPROVER",
}

@Entity("users")
@Index(["email"], { unique: true })
@Index(["stateUt", "role"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  contactNumber: string;

  @Column({ nullable: true })
  ministryId: string;

  @Column({
    type: "enum",
    enum: UserRole,
  })
  role: UserRole;

  @Column({ name: "state_ut" })
  stateUt: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // @OneToMany(() => Submission, (submission) => submission.submittedBy)
  // submissions: Submission[];
}
