import { IsString, IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteSubmissionDataDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  submissionIndicatorId: string;

  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  inputPrimaryId: string[];
}

