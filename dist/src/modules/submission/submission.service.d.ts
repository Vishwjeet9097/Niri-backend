import { Repository, DataSource } from 'typeorm';
import { Submission, SubmissionStatus, SubmissionFile } from '../../entities/submission.entity';
import { UserRole } from '../../entities/user.entity';
import { FinalScore } from '../../entities/final-score.entity';
import { ScoringService } from '../scoring/scoring.service';
import { StorageService } from '../storage/storage.service';
import { CreateSubmissionDto, UpdateSubmissionDto, AddCommentDto, ForwardToMoSPIDto, UpdateStatusDto, ForwardToMoSPIReviewerDto, ForwardToMoSPIApproverDto, SendBackToStateDto, StateRejectDto, FinalRejectDto, ResubmitDto, SubmissionQueryDto } from './dto/submission.dto';
export declare class SubmissionService {
    private submissionRepository;
    private finalScoreRepository;
    private dataSource;
    private scoringService;
    private storageService;
    private readonly logger;
    constructor(submissionRepository: Repository<Submission>, finalScoreRepository: Repository<FinalScore>, dataSource: DataSource, scoringService: ScoringService, storageService: StorageService);
    create(createSubmissionDto: CreateSubmissionDto, userId: string, userRole: UserRole, stateUt: string): Promise<{
        status: boolean;
        data: Submission;
        message: string;
        timestamp: string;
    }>;
    findAll(queryDto: SubmissionQueryDto, userRole: UserRole, userStateUt: string, userId: string): Promise<{
        submissions: Submission[];
        total: number;
    }>;
    findOne(id: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    update(id: string, updateSubmissionDto: UpdateSubmissionDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    addComment(id: string, addCommentDto: AddCommentDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    submitToState(id: string, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    forwardToMoSPI(id: string, forwardDto: ForwardToMoSPIDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    stateReject(id: string, rejectDto: StateRejectDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    finalReject(id: string, rejectDto: FinalRejectDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    resubmit(id: string, resubmitDto: ResubmitDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    approve(id: string, approveDto: {
        status: SubmissionStatus;
        comment?: string;
    }, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    addFileToSubmission(submissionId: string, file: SubmissionFile, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    removeFileFromSubmission(submissionId: string, filePath: string, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    getSubmissionFiles(submissionId: string, userRole: UserRole, userStateUt: string): Promise<SubmissionFile[]>;
    cleanupSubmissionFiles(submissionId: string): Promise<void>;
    private getOwnerRoleFromStatus;
    updateStatus(id: string, updateStatusDto: UpdateStatusDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    forwardToMoSPIReviewer(id: string, forwardDto: ForwardToMoSPIReviewerDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    forwardToMoSPIApprover(id: string, forwardDto: ForwardToMoSPIApproverDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    sendBackToState(id: string, sendBackDto: SendBackToStateDto, userId: string, userRole: UserRole, userStateUt: string): Promise<Submission>;
    private validateStatusTransition;
}
