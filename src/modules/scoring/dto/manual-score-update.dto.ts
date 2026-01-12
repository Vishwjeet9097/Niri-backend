import { IsString, IsNumber, IsUUID, IsNotEmpty, Min, Max } from 'class-validator';

export class ManualScoreUpdateDto {
  @IsUUID()
  @IsNotEmpty()
  submissionId: string;

  @IsString()
  @IsNotEmpty()
  indicatorCode: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(0, { message: 'Updated score cannot be negative' })
  updatedScore: number;

  @IsNumber()
  @Min(0, { message: 'Maximum score cannot be negative' })
  maxScore: number;

  @IsString()
  @IsNotEmpty({ message: 'Update reason is required' })
  updateReason: string;
}

