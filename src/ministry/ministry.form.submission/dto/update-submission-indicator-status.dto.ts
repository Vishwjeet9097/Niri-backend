import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { SubmissionIndicatorStatus } from '../../entities/ministry-submission-indicator.entity';

export class UpdateSubmissionIndicatorStatusDto {
  @IsString()
  @IsNotEmpty()
  submissionIndicatorId: string;

  @IsEnum(SubmissionIndicatorStatus)
  @IsNotEmpty()
  status: SubmissionIndicatorStatus;
}

