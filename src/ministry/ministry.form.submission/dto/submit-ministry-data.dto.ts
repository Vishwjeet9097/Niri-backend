import { IsString, IsObject, IsArray, ValidateNested, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionIndicatorStatus } from '../../entities/ministry-submission-indicator.entity';

class InputDataDto {
  @IsString()
  @IsNotEmpty()
  inputId: string;

  value: any; // Can be string, number, date, or file (JSON)
}

class DataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InputDataDto)
  inputs: InputDataDto[];

  @IsArray()
  subsection: InputDataDto[][]; // Array of arrays: [[{inputId, value}, ...], [{inputId, value}, ...]]
}

export class SubmitMinistryDataDto {
  @IsString()
  @IsNotEmpty()
  submissionIndicatorId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DataDto)
  data: DataDto;

  @IsOptional()
  @IsEnum(SubmissionIndicatorStatus)
  status?: SubmissionIndicatorStatus;
}



