import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
} from "class-validator";
import { IndicatorCategory } from "../../entities/indicator-detail.entity";

export class CreateIndicatorDto {
  @IsString()
  name: string;

  @IsEnum(IndicatorCategory)
  category: IndicatorCategory;

  @IsString()
  sNo: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsString()
  associatedForm?: string;

  // Optional: If not provided, will be auto-generated
  @IsOptional()
  @IsString()
  id?: string;
}

