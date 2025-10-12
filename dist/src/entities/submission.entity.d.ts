import { User, UserRole } from './user.entity';
import { FinalScore } from './final-score.entity';
export declare enum SubmissionStatus {
    DRAFT = "DRAFT",
    SUBMITTED_TO_STATE = "SUBMITTED_TO_STATE",
    SUBMITTED_TO_MOSPI_REVIEWER = "SUBMITTED_TO_MOSPI_REVIEWER",
    SUBMITTED_TO_MOSPI_APPROVER = "SUBMITTED_TO_MOSPI_APPROVER",
    REJECTED = "REJECTED",
    REJECTED_FINAL = "REJECTED_FINAL",
    RETURNED_FROM_STATE = "RETURNED_FROM_STATE",
    RETURNED_FROM_MOSPI = "RETURNED_FROM_MOSPI",
    APPROVED = "APPROVED"
}
export interface ReviewComment {
    timestamp: Date;
    role: UserRole;
    userId: string;
    text: string;
    type: 'comment' | 'rejection' | 'approval';
}
export interface SubmissionFile {
    fileName: string;
    originalName: string;
    filePath: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: Date;
}
export declare class Submission {
    id: string;
    submissionId: string;
    stateUt: string;
    submittedBy: string;
    user: User;
    rejectionCount: number;
    formData: Record<string, any>;
    reviewComments: ReviewComment[];
    attachedFiles: SubmissionFile[];
    status: SubmissionStatus;
    currentOwnerRole: UserRole;
    createdAt: Date;
    updatedAt: Date;
    finalScore: FinalScore;
}
