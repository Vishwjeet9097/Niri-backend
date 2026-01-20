import { IsString, IsNotEmpty, IsUUID, IsEnum, IsOptional } from 'class-validator';

export enum DeleteFileAction {
  BY_SUBMISSION_INDICATOR = 'by-submission-indicator',
  BY_PRIMARY_ID = 'by-primary-id',
}

export class DeleteFileDataDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(DeleteFileAction)
  action: DeleteFileAction;

  @IsOptional()
  @IsString()
  @IsUUID()
  submissionIndicatorId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  primaryId?: string;
}

