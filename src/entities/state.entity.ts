import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("states")
@Index(["code"], { unique: true })
export class State {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  code: string; // e.g., "DL", "MH", "KA"

  @Column()
  name: string; // e.g., "Delhi", "Maharashtra", "Karnataka"

  @Column({ type: "varchar", length: 2, nullable: true })
  type: string; // "STATE" or "UT"

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
