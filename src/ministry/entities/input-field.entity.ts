import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum DataType {
  NUMBER = "number",
  FILE = "file",
  STRING = "string",
  DROPDOWN = "dropdown",
}

@Entity("ministry_input_fields")
@Index(["sectionId", "sequence"])
export class InputField {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "section_id" })
  sectionId: string; // Can be subsection id or indicator id

  @Column()
  label: string;

  @Column({
    name: "data_type",
    type: "enum",
    enum: DataType,
    default: DataType.STRING,
  })
  dataType: DataType;

  @Column({ name: "validation_rules", type: "jsonb", nullable: true })
  validationRules: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedTypes?: string[]; // For file type
    maxFileSize?: number; // For file type
    [key: string]: any; // Allow additional validation rules
  } | null;

  @Column({ type: "integer", default: 0 })
  sequence: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

