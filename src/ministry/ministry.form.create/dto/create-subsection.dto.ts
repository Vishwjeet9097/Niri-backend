import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
} from "class-validator";

export class CreateSubsectionDto {
  @IsString()
  name: string;

  @IsString()
  indicatorId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  // Optional: If not provided, will be auto-generated
  @IsOptional()
  @IsString()
  id?: string;
}

