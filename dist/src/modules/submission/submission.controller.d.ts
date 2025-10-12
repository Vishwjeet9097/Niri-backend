import { SubmissionService } from './submission.service';
import { CreateSubmissionDto, UpdateSubmissionDto, AddCommentDto, ForwardToMoSPIDto, UpdateStatusDto, ForwardToMoSPIReviewerDto, ForwardToMoSPIApproverDto, SendBackToStateDto, StateRejectDto, FinalRejectDto, ResubmitDto } from './dto/submission.dto';
import { SubmissionStatus } from '../../entities/submission.entity';
export declare class SubmissionController {
    private readonly submissionService;
    constructor(submissionService: SubmissionService);
    create(createSubmissionDto: CreateSubmissionDto, req: any): Promise<{
        status: boolean;
        data: import("../../entities/submission.entity").Submission;
        message: string;
        timestamp: string;
    }>;
    findAll(queryDto: any, req: any): Promise<{
        submissions: import("../../entities/submission.entity").Submission[];
        total: number;
    }>;
    findOne(id: string, req: any): Promise<import("../../entities/submission.entity").Submission>;
    update(id: string, updateSubmissionDto: UpdateSubmissionDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    addComment(id: string, addCommentDto: AddCommentDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    updateStatus(id: string, updateStatusDto: UpdateStatusDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    forwardToMoSPIReviewer(id: string, forwardDto: ForwardToMoSPIReviewerDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    forwardToMoSPIApprover(id: string, forwardDto: ForwardToMoSPIApproverDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    sendBackToState(id: string, sendBackDto: SendBackToStateDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    forwardToMoSPI(id: string, forwardDto: ForwardToMoSPIDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    stateReject(id: string, rejectDto: StateRejectDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    finalReject(id: string, rejectDto: FinalRejectDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    resubmit(id: string, resubmitDto: ResubmitDto, req: any): Promise<import("../../entities/submission.entity").Submission>;
    submitToState(id: string, req: any): Promise<import("../../entities/submission.entity").Submission>;
    approve(id: string, approveDto: {
        status: SubmissionStatus;
        comment?: string;
    }, req: any): Promise<import("../../entities/submission.entity").Submission>;
}
