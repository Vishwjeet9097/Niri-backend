import { IsString, IsObject, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionStatus, ReviewComment } from '../../../entities/submission.entity';
import { UserRole } from '../../../entities/user.entity';

export class CreateSubmissionDto {
  @IsString()
  submissionId: string;

  @IsObject()
  formData: Record<string, any>;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}

export class UpdateSubmissionDto {
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;
}

export class AddCommentDto {
  @IsString()
  text: string;

  @IsEnum(['comment', 'rejection', 'approval'])
  type: 'comment' | 'rejection' | 'approval';
}

export class ForwardToMoSPIDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateStatusDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ForwardToMoSPIReviewerDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ForwardToMoSPIApproverDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SendBackToStateDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class StateRejectDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsString()
  comment: string;
}

export class FinalRejectDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsString()
  comment: string;
}

export class ResubmitDto {
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmissionQueryDto {
  @IsOptional()
  status?: string; // Removed @IsString() decorator to bypass validation

  @IsOptional()
  @IsString()
  stateUt?: string;

  @IsOptional()
  @IsString()
  submittedBy?: string;

  @IsOptional()
  @IsEnum(UserRole)
  currentOwnerRole?: UserRole;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
