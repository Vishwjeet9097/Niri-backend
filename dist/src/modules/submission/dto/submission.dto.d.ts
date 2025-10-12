import { SubmissionStatus } from '../../../entities/submission.entity';
import { UserRole } from '../../../entities/user.entity';
export declare class CreateSubmissionDto {
    submissionId: string;
    formData: Record<string, any>;
    status?: SubmissionStatus;
}
export declare class UpdateSubmissionDto {
    formData?: Record<string, any>;
}
export declare class AddCommentDto {
    text: string;
    type: 'comment' | 'rejection' | 'approval';
}
export declare class ForwardToMoSPIDto {
    comment?: string;
}
export declare class UpdateStatusDto {
    status: SubmissionStatus;
    comment?: string;
}
export declare class ForwardToMoSPIReviewerDto {
    status: SubmissionStatus;
    comment?: string;
}
export declare class ForwardToMoSPIApproverDto {
    status: SubmissionStatus;
    comment?: string;
}
export declare class SendBackToStateDto {
    status: SubmissionStatus;
    comment?: string;
}
export declare class StateRejectDto {
    status: SubmissionStatus;
    comment: string;
}
export declare class FinalRejectDto {
    status: SubmissionStatus;
    comment: string;
}
export declare class ResubmitDto {
    formData?: Record<string, any>;
    comment?: string;
}
export declare class SubmissionQueryDto {
    status?: string;
    stateUt?: string;
    submittedBy?: string;
    currentOwnerRole?: UserRole;
    page?: string;
    limit?: string;
}
