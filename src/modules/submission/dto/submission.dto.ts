import {
  IsString,
  IsObject,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  SubmissionStatus,
  ReviewComment,
} from "../../../entities/submission.entity";
import { UserRole } from "../../../entities/user.entity";


export class CreateSubmissionDto {
  @IsString()
  submissionId: string;

  @IsObject()
  formData: Record<string, any>;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

   @IsOptional()
  @IsArray()
  attachedFiles?: Array<{
    fileName?: string;
    originalName?: string;
    filePath?: string;
    fileUrl?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedAt?: string|Date;
  }>;
}

export class UpdateSubmissionDto {
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;
}

export class AddCommentDto {
  @IsString()
  text: string;

  @IsEnum(["comment", "rejection", "approval", "indicator_comment"])
  type: "comment" | "rejection" | "approval" | "indicator_comment";

  @IsString()
  sectionId: string;
}

export class ForwardToMoSPIDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  sectionId?: string; // Optional sectionId field, defaults to "status-change" if not provided
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

  @IsString()
  sectionId: string;
}

export class ForwardToMoSPIApproverDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  sectionId: string;
}

export class SendBackToStateDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  sectionId: string;
}

export class StateRejectDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsString()
  comment: string;

  @IsString()
  sectionId: string;
}

export class FinalRejectDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsString()
  comment: string;

  @IsString()
  sectionId: string;
}

export class SectionComment {
  @IsString()
  sectionId: string;

  @IsString()
  text: string;

  @IsEnum(["comment", "rejection", "approval"])
  type: "comment" | "rejection" | "approval";
}

export class SubmitWithSectionCommentsDto {
  @IsObject()
  formData: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionComment)
  sectionComments?: SectionComment[];

  @IsOptional()
  @IsString()
  overallComment?: string;
}

export class ResubmitDto {
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionComment)
  sectionComments?: SectionComment[];
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
