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
  DATE = "date",
}

export enum UIComponent {
  INPUT_TEXT = "Input (Text)",
  INPUT_NUMBER = "Input (Number)",
  INPUT_DATE = "Input (Date)",
  DROPDOWN = "Dropdown",
  AUTO_CALCULATED = "Auto-calculated field",
  FILE = "File",
  CHECKBOXES = "Checkbox",
  TEXT_AREA = "Text Area",
  RADIO_BUTTON = "Radio Button",
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

  @Column({
    name: "ui_component",
    type: "enum",
    enum: UIComponent,
    default: UIComponent.INPUT_TEXT,
  })
  uiComponent: UIComponent;

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

