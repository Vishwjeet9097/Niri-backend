"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const common_1 = require("@nestjs/common");
const submission_service_1 = require("./submission.service");
const submission_entity_1 = require("../../entities/submission.entity");
const user_entity_1 = require("../../entities/user.entity");
const final_score_entity_1 = require("../../entities/final-score.entity");
const scoring_service_1 = require("../scoring/scoring.service");
describe('SubmissionService', () => {
    let service;
    let submissionRepository;
    let finalScoreRepository;
    let dataSource;
    let scoringService;
    const mockSubmissionRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        createQueryBuilder: jest.fn(),
    };
    const mockFinalScoreRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
    };
    const mockDataSource = {
        transaction: jest.fn(),
    };
    const mockScoringService = {
        calculateScore: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                submission_service_1.SubmissionService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(submission_entity_1.Submission),
                    useValue: mockSubmissionRepository,
                },
                {
                    provide: (0, typeorm_1.getRepositoryToken)(final_score_entity_1.FinalScore),
                    useValue: mockFinalScoreRepository,
                },
                {
                    provide: typeorm_2.DataSource,
                    useValue: mockDataSource,
                },
                {
                    provide: scoring_service_1.ScoringService,
                    useValue: mockScoringService,
                },
            ],
        }).compile();
        service = module.get(submission_service_1.SubmissionService);
        submissionRepository = module.get((0, typeorm_1.getRepositoryToken)(submission_entity_1.Submission));
        finalScoreRepository = module.get((0, typeorm_1.getRepositoryToken)(final_score_entity_1.FinalScore));
        dataSource = module.get(typeorm_2.DataSource);
        scoringService = module.get(scoring_service_1.ScoringService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('create', () => {
        const createSubmissionDto = {
            submissionId: 'SUB-001',
            formData: { indicator1: 10, indicator2: 20 },
        };
        it('should create submission successfully for Nodal Officer', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(null);
            mockSubmissionRepository.create.mockReturnValue({
                ...createSubmissionDto,
                id: 'submission-id',
                submittedBy: 'user-id',
                stateUt: 'Maharashtra',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
            });
            mockSubmissionRepository.save.mockResolvedValue({
                ...createSubmissionDto,
                id: 'submission-id',
            });
            const result = await service.create(createSubmissionDto, 'user-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra');
            expect(result).toBeDefined();
            expect(mockSubmissionRepository.findOne).toHaveBeenCalledWith({
                where: { submissionId: createSubmissionDto.submissionId },
            });
            expect(mockSubmissionRepository.create).toHaveBeenCalled();
            expect(mockSubmissionRepository.save).toHaveBeenCalled();
        });
        it('should throw ForbiddenException for non-Nodal Officer', async () => {
            await expect(service.create(createSubmissionDto, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra')).rejects.toThrow(common_1.ForbiddenException);
        });
        it('should throw BadRequestException for duplicate submission ID', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue({ id: 'existing-submission' });
            await expect(service.create(createSubmissionDto, 'user-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('findOne', () => {
        const mockSubmission = {
            id: 'submission-id',
            submittedBy: 'user-id',
            stateUt: 'Maharashtra',
            status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
        };
        it('should return submission for authorized user', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
            const result = await service.findOne('submission-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra');
            expect(result).toEqual(mockSubmission);
            expect(mockSubmissionRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'submission-id' },
                relations: ['user', 'finalScore'],
            });
        });
        it('should throw NotFoundException if submission not found', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(null);
            await expect(service.findOne('non-existent-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should throw ForbiddenException for unauthorized access', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
            await expect(service.findOne('submission-id', user_entity_1.UserRole.NODAL_OFFICER, 'DifferentState')).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('forwardToMoSPI', () => {
        const forwardDto = { comment: 'Forwarding to MoSPI' };
        const mockSubmission = {
            id: 'submission-id',
            status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
            reviewComments: [],
        };
        it('should forward submission to MoSPI successfully', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
            mockDataSource.transaction.mockImplementation(async (callback) => {
                return callback({
                    update: jest.fn().mockResolvedValue({}),
                });
            });
            const result = await service.forwardToMoSPI('submission-id', forwardDto, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra');
            expect(result).toBeDefined();
            expect(mockDataSource.transaction).toHaveBeenCalled();
        });
        it('should throw ForbiddenException for non-State Approver', async () => {
            await expect(service.forwardToMoSPI('submission-id', forwardDto, 'user-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra')).rejects.toThrow(common_1.ForbiddenException);
        });
        it('should throw BadRequestException for wrong status', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue({
                ...mockSubmission,
                status: submission_entity_1.SubmissionStatus.APPROVED,
            });
            await expect(service.forwardToMoSPI('submission-id', forwardDto, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('stateReject', () => {
        const rejectDto = {
            status: submission_entity_1.SubmissionStatus.REJECTED,
            comment: 'Rejected by state',
        };
        const mockSubmission = {
            id: 'submission-id',
            status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
            reviewComments: [],
        };
        it('should reject submission successfully', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
            mockDataSource.transaction.mockImplementation(async (callback) => {
                return callback({
                    update: jest.fn().mockResolvedValue({}),
                });
            });
            const result = await service.stateReject('submission-id', rejectDto, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra');
            expect(result).toBeDefined();
            expect(mockDataSource.transaction).toHaveBeenCalled();
        });
        it('should throw ForbiddenException for non-State Approver', async () => {
            await expect(service.stateReject('submission-id', rejectDto, 'user-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra')).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('finalReject', () => {
        const rejectDto = {
            status: submission_entity_1.SubmissionStatus.REJECTED_FINAL,
            comment: 'Final rejection',
        };
        const mockSubmission = {
            id: 'submission-id',
            status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            rejectionCount: 0,
            reviewComments: [],
        };
        it('should reject submission with rejection count < 1', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
            mockDataSource.transaction.mockImplementation(async (callback) => {
                return callback({
                    update: jest.fn().mockResolvedValue({}),
                });
            });
            const result = await service.finalReject('submission-id', rejectDto, 'user-id', user_entity_1.UserRole.MOSPI_APPROVER, 'Maharashtra');
            expect(result).toBeDefined();
            expect(mockDataSource.transaction).toHaveBeenCalled();
        });
        it('should throw ForbiddenException for non-MoSPI Approver', async () => {
            await expect(service.finalReject('submission-id', rejectDto, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra')).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('approve', () => {
        const mockSubmission = {
            id: 'submission-id',
            status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            reviewComments: [],
        };
        it('should approve submission and calculate score', async () => {
            mockSubmissionRepository.findOne.mockResolvedValue(mockSubmission);
            mockDataSource.transaction.mockImplementation(async (callback) => {
                return callback({
                    update: jest.fn().mockResolvedValue({}),
                });
            });
            mockScoringService.calculateScore.mockResolvedValue({});
            const result = await service.approve('submission-id', { status: submission_entity_1.SubmissionStatus.APPROVED, comment: 'Approved' }, 'user-id', user_entity_1.UserRole.MOSPI_APPROVER, 'Maharashtra');
            expect(result).toBeDefined();
            expect(mockDataSource.transaction).toHaveBeenCalled();
            expect(mockScoringService.calculateScore).toHaveBeenCalledWith('submission-id', 'user-id');
        });
        it('should throw ForbiddenException for non-MoSPI Approver', async () => {
            await expect(service.approve('submission-id', { status: submission_entity_1.SubmissionStatus.APPROVED, comment: 'Approved' }, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra')).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('updateStatus', () => {
        it('should update submission status successfully', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.DRAFT,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            submissionRepository.update.mockResolvedValue({ affected: 1 });
            submissionRepository.findOne.mockResolvedValueOnce(mockSubmission).mockResolvedValueOnce({
                ...mockSubmission,
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
            });
            const result = await service.updateStatus('submission-id', { status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE, comment: 'Test comment' }, 'user-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra');
            expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                reviewComments: expect.any(Array),
            });
            expect(result.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
        });
        it('should throw BadRequestException for invalid status transition', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.APPROVED,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            await expect(service.updateStatus('submission-id', { status: submission_entity_1.SubmissionStatus.DRAFT }, 'user-id', user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('forwardToMoSPIReviewer', () => {
        it('should forward submission to MoSPI Reviewer successfully', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            submissionRepository.update.mockResolvedValue({ affected: 1 });
            submissionRepository.findOne.mockResolvedValueOnce(mockSubmission).mockResolvedValueOnce({
                ...mockSubmission,
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                currentOwnerRole: user_entity_1.UserRole.MOSPI_REVIEWER,
            });
            const result = await service.forwardToMoSPIReviewer('submission-id', {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                comment: 'Forwarding to MoSPI Reviewer',
            }, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra');
            expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                currentOwnerRole: user_entity_1.UserRole.MOSPI_REVIEWER,
                reviewComments: expect.any(Array),
            });
            expect(result.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
        });
        it('should throw BadRequestException if submission is not in SUBMITTED_TO_STATE', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.DRAFT,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            await expect(service.forwardToMoSPIReviewer('submission-id', { status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER, comment: 'Test' }, 'user-id', user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('forwardToMoSPIApprover', () => {
        it('should forward submission to MoSPI Approver successfully', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            submissionRepository.update.mockResolvedValue({ affected: 1 });
            submissionRepository.findOne.mockResolvedValueOnce(mockSubmission).mockResolvedValueOnce({
                ...mockSubmission,
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
                currentOwnerRole: user_entity_1.UserRole.MOSPI_APPROVER,
            });
            const result = await service.forwardToMoSPIApprover('submission-id', {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
                comment: 'Forwarding to MoSPI Approver',
            }, 'user-id', user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra');
            expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
                currentOwnerRole: user_entity_1.UserRole.MOSPI_APPROVER,
                reviewComments: expect.any(Array),
            });
            expect(result.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER);
        });
        it('should throw BadRequestException if submission is not in SUBMITTED_TO_MOSPI_REVIEWER', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.DRAFT,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            await expect(service.forwardToMoSPIApprover('submission-id', { status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER, comment: 'Test' }, 'user-id', user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('sendBackToState', () => {
        it('should send submission back to state successfully', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                reviewComments: [],
                rejectionCount: 0,
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            submissionRepository.update.mockResolvedValue({ affected: 1 });
            submissionRepository.findOne.mockResolvedValueOnce(mockSubmission).mockResolvedValueOnce({
                ...mockSubmission,
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                rejectionCount: 1,
            });
            const result = await service.sendBackToState('submission-id', { status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE, comment: 'Send back for corrections' }, 'user-id', user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra');
            expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                reviewComments: expect.any(Array),
                rejectionCount: expect.any(Function),
            });
            expect(result.status).toBe(submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
        });
        it('should throw BadRequestException if submission is not in MoSPI status', async () => {
            const mockSubmission = {
                id: 'submission-id',
                status: submission_entity_1.SubmissionStatus.DRAFT,
                reviewComments: [],
            };
            submissionRepository.findOne.mockResolvedValue(mockSubmission);
            await expect(service.sendBackToState('submission-id', { status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE, comment: 'Test' }, 'user-id', user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra')).rejects.toThrow(common_1.BadRequestException);
        });
    });
});
//# sourceMappingURL=submission.service.spec.js.map