import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsObject,
  Min,
} from "class-validator";
import { DataType, UIComponent } from "../../entities/input-field.entity";

export class CreateInputFieldDto {
  @IsString()
  sectionId: string;

  @IsString()
  label: string;

  @IsEnum(DataType)
  dataType: DataType;

  @IsEnum(UIComponent)
  uiComponent: UIComponent;

  @IsOptional()
  @IsObject()
  validationRules?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedTypes?: string[];
    maxFileSize?: number;
    [key: string]: any;
  };

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}

