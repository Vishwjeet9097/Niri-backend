import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { UserIndicatorScope } from "./user-indicator-scope.entity";

@Entity("indicators")
@Index(["code"], { unique: true })
@Index(["sectionId"])
export class Indicator {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  code: string; // e.g., "1.1", "1.2", "2.1"

  @Column({ name: "section_id" })
  sectionId: string; // e.g., "1", "2", "3"

  @Column({ name: "indicator_name" })
  name: string; // e.g., "Infrastructure Financing", "Infrastructure Development"

  @Column({ name: "max_score", type: "decimal", precision: 10, scale: 2 })
  maxScore: number;

  @Column({ name: "category" })
  category: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @OneToMany(
    () => UserIndicatorScope,
    (userIndicatorScope) => userIndicatorScope.indicator
  )
  userIndicatorScopes: UserIndicatorScope[];
}
