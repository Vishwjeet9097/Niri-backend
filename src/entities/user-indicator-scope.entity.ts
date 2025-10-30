import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "./user.entity";
import { Indicator } from "./indicator.entity";

@Entity("user_indicator_scope")
@Index(["userId"])
@Index(["indicatorId"])
@Unique(["userId", "indicatorId"])
export class UserIndicatorScope {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "indicator_id" })
  indicatorId: string;

  @ManyToOne(() => Indicator)
  @JoinColumn({ name: "indicator_id" })
  indicator: Indicator;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
