"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SubmissionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("../../entities/submission.entity");
const user_entity_1 = require("../../entities/user.entity");
const final_score_entity_1 = require("../../entities/final-score.entity");
const scoring_service_1 = require("../scoring/scoring.service");
const storage_service_1 = require("../storage/storage.service");
let SubmissionService = SubmissionService_1 = class SubmissionService {
    constructor(submissionRepository, finalScoreRepository, dataSource, scoringService, storageService) {
        this.submissionRepository = submissionRepository;
        this.finalScoreRepository = finalScoreRepository;
        this.dataSource = dataSource;
        this.scoringService = scoringService;
        this.storageService = storageService;
        this.logger = new common_1.Logger(SubmissionService_1.name);
    }
    async create(createSubmissionDto, userId, userRole, stateUt) {
        try {
            this.logger.log(`=== CREATE SUBMISSION START ===`);
            this.logger.log(`UserId: ${userId}, UserRole: ${userRole}, StateUt: ${stateUt}`);
            this.logger.log(`CreateSubmissionDto: ${JSON.stringify(createSubmissionDto)}`);
            if (userRole !== user_entity_1.UserRole.NODAL_OFFICER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: NODAL_OFFICER`);
                throw new common_1.ForbiddenException('Only Nodal Officers can create submissions');
            }
            this.logger.log(`Checking for existing submission with ID: ${createSubmissionDto.submissionId}`);
            const existingSubmission = await this.submissionRepository.findOne({
                where: { submissionId: createSubmissionDto.submissionId },
            });
            if (existingSubmission) {
                this.logger.error(`Submission ID already exists: ${createSubmissionDto.submissionId}`);
                throw new common_1.BadRequestException('Submission ID already exists');
            }
            const status = createSubmissionDto.status || submission_entity_1.SubmissionStatus.DRAFT;
            const currentOwnerRole = this.getOwnerRoleFromStatus(status);
            this.logger.log(`Initial Status: ${status}, Owner Role: ${currentOwnerRole}`);
            const submission = this.submissionRepository.create({
                submissionId: createSubmissionDto.submissionId,
                formData: createSubmissionDto.formData,
                submittedBy: userId,
                stateUt,
                status: status,
                currentOwnerRole: currentOwnerRole,
            });
            const savedSubmission = await this.submissionRepository.save(submission);
            this.logger.log(`Submission created successfully: ${savedSubmission.id}`);
            this.logger.log(`Final Status: ${savedSubmission.status}, Owner: ${savedSubmission.currentOwnerRole}`);
            this.logger.log(`=== CREATE SUBMISSION SUCCESS ===`);
            return {
                status: true,
                data: savedSubmission,
                message: 'Submission created successfully',
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            this.logger.error(`=== CREATE SUBMISSION ERROR ===`);
            this.logger.error(`Error creating submission: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async findAll(queryDto, userRole, userStateUt, userId) {
        const { status, stateUt, submittedBy, currentOwnerRole, page = '1', limit = '10' } = queryDto;
        const query = this.submissionRepository
            .createQueryBuilder('submission')
            .leftJoinAndSelect('submission.user', 'user')
            .leftJoinAndSelect('submission.finalScore', 'finalScore');
        if (userRole === user_entity_1.UserRole.NODAL_OFFICER) {
            query.andWhere('submission.stateUt = :stateUt', { stateUt: userStateUt });
            query.andWhere('submission.submittedBy = :userId', { userId });
        }
        else if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
            query.andWhere('submission.stateUt = :stateUt', { stateUt: userStateUt });
        }
        if (status) {
            const statusArray = status.split(',').map((s) => s.trim());
            if (statusArray.length === 1) {
                query.andWhere('submission.status = :status', { status: statusArray[0] });
            }
            else {
                query.andWhere('submission.status IN (:...statuses)', { statuses: statusArray });
            }
        }
        if (stateUt && [user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER].includes(userRole)) {
            query.andWhere('submission.stateUt = :stateUt', { stateUt });
        }
        if (currentOwnerRole) {
            query.andWhere('submission.currentOwnerRole = :currentOwnerRole', { currentOwnerRole });
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        query.skip(skip).take(parseInt(limit));
        query.orderBy('submission.createdAt', 'DESC');
        const [submissions, total] = await query.getManyAndCount();
        return { submissions, total };
    }
    async findOne(id, userRole, userStateUt) {
        try {
            this.logger.log(`=== FIND ONE SUBMISSION START ===`);
            this.logger.log(`ID: ${id}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            const submission = await this.submissionRepository.findOne({
                where: { id },
                relations: ['user', 'finalScore'],
            });
            if (!submission) {
                this.logger.error(`Submission not found with ID: ${id}`);
                throw new common_1.NotFoundException('Submission not found');
            }
            this.logger.log(`Found submission: ${submission.id}, Status: ${submission.status}, StateUt: ${submission.stateUt}`);
            if (userRole === user_entity_1.UserRole.NODAL_OFFICER && submission.stateUt !== userStateUt) {
                this.logger.error(`Access denied for NODAL_OFFICER. Submission StateUt: ${submission.stateUt}, User StateUt: ${userStateUt}`);
                throw new common_1.ForbiddenException('Access denied');
            }
            if (userRole === user_entity_1.UserRole.STATE_APPROVER && submission.stateUt !== userStateUt) {
                this.logger.error(`Access denied for STATE_APPROVER. Submission StateUt: ${submission.stateUt}, User StateUt: ${userStateUt}`);
                throw new common_1.ForbiddenException('Access denied');
            }
            this.logger.log(`Access granted for user role: ${userRole}`);
            this.logger.log(`=== FIND ONE SUBMISSION SUCCESS ===`);
            return submission;
        }
        catch (error) {
            this.logger.error(`=== FIND ONE SUBMISSION ERROR ===`);
            this.logger.error(`Error finding submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async update(id, updateSubmissionDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== UPDATE SUBMISSION START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`UpdateSubmissionDto: ${JSON.stringify(updateSubmissionDto)}`);
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (userRole !== user_entity_1.UserRole.NODAL_OFFICER || submission.submittedBy !== userId) {
                this.logger.error(`Invalid user role or ownership. UserRole: ${userRole}, Owner: ${submission.submittedBy}`);
                throw new common_1.ForbiddenException('Only Nodal Officers can update their own submissions');
            }
            if (submission.status !== submission_entity_1.SubmissionStatus.DRAFT) {
                this.logger.error(`Invalid status for update: ${submission.status}. Expected: DRAFT`);
                throw new common_1.BadRequestException('Cannot update submission that has been submitted');
            }
            this.logger.log(`Updating submission with data: ${JSON.stringify(updateSubmissionDto)}`);
            await this.submissionRepository.update(id, updateSubmissionDto);
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Submission updated successfully: ${updatedSubmission.id}`);
            this.logger.log(`=== UPDATE SUBMISSION SUCCESS ===`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`=== UPDATE SUBMISSION ERROR ===`);
            this.logger.error(`Error updating submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async addComment(id, addCommentDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== ADD COMMENT START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`AddCommentDto: ${JSON.stringify(addCommentDto)}`);
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            const comment = {
                timestamp: new Date(),
                role: userRole,
                userId,
                text: addCommentDto.text,
                type: addCommentDto.type,
            };
            this.logger.log(`Adding comment: ${addCommentDto.text} (Type: ${addCommentDto.type})`);
            const updatedComments = [...submission.reviewComments, comment];
            this.logger.log(`Total comments after update: ${updatedComments.length}`);
            await this.submissionRepository.update(id, {
                reviewComments: updatedComments,
            });
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Comment added successfully to submission: ${updatedSubmission.id}`);
            this.logger.log(`=== ADD COMMENT SUCCESS ===`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`=== ADD COMMENT ERROR ===`);
            this.logger.error(`Error adding comment to submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async submitToState(id, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== SUBMIT TO STATE START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            if (userRole !== user_entity_1.UserRole.NODAL_OFFICER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: NODAL_OFFICER`);
                throw new common_1.ForbiddenException('Only Nodal Officers can submit to state');
            }
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (submission.status !== submission_entity_1.SubmissionStatus.DRAFT) {
                this.logger.error(`Invalid status for submit to state: ${submission.status}. Expected: DRAFT`);
                throw new common_1.BadRequestException('Submission must be in draft status to submit to state');
            }
            this.logger.log(`Updating submission status to: SUBMITTED_TO_STATE`);
            this.logger.log(`Updating owner role to: STATE_APPROVER`);
            await this.submissionRepository.update(id, {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
            });
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Submission submitted to state successfully: ${updatedSubmission.id}`);
            this.logger.log(`Final Status: ${updatedSubmission.status}, Owner: ${updatedSubmission.currentOwnerRole}`);
            this.logger.log(`=== SUBMIT TO STATE SUCCESS ===`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`=== SUBMIT TO STATE ERROR ===`);
            this.logger.error(`Error submitting to state ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async forwardToMoSPI(id, forwardDto, userId, userRole, userStateUt) {
        try {
            console.log('=== FORWARD TO MOSPI DEBUG START ===');
            console.log('ID:', id);
            console.log('ForwardDto:', forwardDto);
            console.log('UserId:', userId);
            console.log('UserRole:', userRole);
            console.log('UserStateUt:', userStateUt);
            console.log('UserRole.STATE_APPROVER:', user_entity_1.UserRole.STATE_APPROVER);
            console.log('Role comparison:', userRole === user_entity_1.UserRole.STATE_APPROVER);
            this.logger.log(`Forwarding submission ${id} to MoSPI by user ${userId} with role ${userRole}`);
            if (userRole !== user_entity_1.UserRole.STATE_APPROVER) {
                console.log('Role check failed - throwing ForbiddenException');
                throw new common_1.ForbiddenException('Only State Approvers can forward submissions to MoSPI');
            }
            console.log('Role check passed, finding submission...');
            const submission = await this.findOne(id, userRole, userStateUt);
            console.log('Submission found:', {
                id: submission.id,
                status: submission.status,
                currentOwnerRole: submission.currentOwnerRole,
                stateUt: submission.stateUt,
            });
            this.logger.log(`Found submission: ${JSON.stringify({
                id: submission.id,
                status: submission.status,
                currentOwnerRole: submission.currentOwnerRole,
                stateUt: submission.stateUt,
            })}`);
            console.log('Checking status...');
            console.log('Current status:', submission.status);
            console.log('Expected status:', submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
            console.log('Status comparison:', submission.status === submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE);
            if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE) {
                console.log('Status check failed - throwing BadRequestException');
                throw new common_1.BadRequestException(`Submission must be in SUBMITTED_TO_STATE status, but current status is ${submission.status}`);
            }
            console.log('Status check passed, processing comments...');
            let updatedComments = [...submission.reviewComments];
            if (forwardDto.comment) {
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: forwardDto.comment,
                    type: 'comment',
                };
                updatedComments.push(comment);
                console.log('Comment added:', comment);
            }
            console.log('Updating submission...');
            console.log('New status:', submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
            console.log('New currentOwnerRole:', user_entity_1.UserRole.MOSPI_REVIEWER);
            console.log('Updated comments count:', updatedComments.length);
            this.logger.log(`Updating submission with status: ${submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER}, currentOwnerRole: ${user_entity_1.UserRole.MOSPI_REVIEWER}`);
            const updateResult = await this.submissionRepository.update(id, {
                status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                currentOwnerRole: user_entity_1.UserRole.MOSPI_REVIEWER,
                reviewComments: updatedComments,
            });
            console.log('Update result:', updateResult);
            console.log('Fetching updated submission...');
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            console.log('Updated submission:', {
                id: updatedSubmission.id,
                status: updatedSubmission.status,
                currentOwnerRole: updatedSubmission.currentOwnerRole,
            });
            console.log('=== FORWARD TO MOSPI DEBUG END ===');
            return updatedSubmission;
        }
        catch (error) {
            console.log('=== ERROR IN FORWARD TO MOSPI ===');
            console.log('Error message:', error.message);
            console.log('Error stack:', error.stack);
            console.log('=== ERROR END ===');
            this.logger.error(`Error in forwardToMoSPI: ${error.message}`, error.stack);
            throw error;
        }
    }
    async stateReject(id, rejectDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== STATE REJECT START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`RejectDto: ${JSON.stringify(rejectDto)}`);
            if (userRole !== user_entity_1.UserRole.STATE_APPROVER && userRole !== user_entity_1.UserRole.MOSPI_APPROVER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: STATE_APPROVER or MOSPI_APPROVER`);
                throw new common_1.ForbiddenException('Only State Approvers or MoSPI Approvers can reject submissions');
            }
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
                if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE &&
                    submission.status !== submission_entity_1.SubmissionStatus.RETURNED_FROM_MOSPI &&
                    submission.status !== submission_entity_1.SubmissionStatus.RETURNED_FROM_STATE) {
                    this.logger.error(`Invalid status for State reject: ${submission.status}. Expected: SUBMITTED_TO_STATE, RETURNED_FROM_MOSPI, or RETURNED_FROM_STATE`);
                    throw new common_1.BadRequestException('Submission must be in SUBMITTED_TO_STATE, RETURNED_FROM_MOSPI, or RETURNED_FROM_STATE status');
                }
            }
            else if (userRole === user_entity_1.UserRole.MOSPI_APPROVER) {
                if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER) {
                    this.logger.error(`Invalid status for MoSPI return: ${submission.status}. Expected: SUBMITTED_TO_MOSPI_APPROVER`);
                    throw new common_1.BadRequestException('Submission must be in SUBMITTED_TO_MOSPI_APPROVER status');
                }
            }
            if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
                if (rejectDto.status !== submission_entity_1.SubmissionStatus.REJECTED &&
                    rejectDto.status !== submission_entity_1.SubmissionStatus.RETURNED_FROM_STATE) {
                    this.logger.error(`Invalid target status: ${rejectDto.status}. Expected: REJECTED or RETURNED_FROM_STATE`);
                    throw new common_1.BadRequestException('State rejection must set status to REJECTED or RETURNED_FROM_STATE');
                }
            }
            else if (userRole === user_entity_1.UserRole.MOSPI_APPROVER) {
                if (rejectDto.status !== submission_entity_1.SubmissionStatus.RETURNED_FROM_MOSPI) {
                    this.logger.error(`Invalid target status: ${rejectDto.status}. Expected: RETURNED_FROM_MOSPI`);
                    throw new common_1.BadRequestException('MoSPI return must set status to RETURNED_FROM_MOSPI');
                }
            }
            this.logger.log(`Processing state rejection with comment: ${rejectDto.comment}`);
            return this.dataSource.transaction(async (manager) => {
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: rejectDto.comment,
                    type: 'rejection',
                };
                this.logger.log(`Adding rejection comment: ${rejectDto.comment}`);
                await manager.update(submission_entity_1.Submission, id, {
                    status: rejectDto.status,
                    currentOwnerRole: user_entity_1.UserRole.NODAL_OFFICER,
                    reviewComments: [...submission.reviewComments, comment],
                });
                this.logger.log(`State rejection completed successfully`);
                this.logger.log(`Final Status: ${rejectDto.status}, Owner: NODAL_OFFICER`);
                this.logger.log(`=== STATE REJECT SUCCESS ===`);
                return this.findOne(id, userRole, userStateUt);
            });
        }
        catch (error) {
            this.logger.error(`=== STATE REJECT ERROR ===`);
            this.logger.error(`Error rejecting submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async finalReject(id, rejectDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== FINAL REJECT START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`RejectDto: ${JSON.stringify(rejectDto)}`);
            if (userRole !== user_entity_1.UserRole.MOSPI_APPROVER && userRole !== user_entity_1.UserRole.STATE_APPROVER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: MOSPI_APPROVER or STATE_APPROVER`);
                throw new common_1.ForbiddenException('Only MoSPI Approvers or State Approvers can perform final rejection');
            }
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (userRole === user_entity_1.UserRole.MOSPI_APPROVER) {
                if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER) {
                    this.logger.error(`Invalid status for MoSPI final reject: ${submission.status}. Expected: SUBMITTED_TO_MOSPI_APPROVER`);
                    throw new common_1.BadRequestException('Submission must be in SUBMITTED_TO_MOSPI_APPROVER status');
                }
            }
            else if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
                if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE &&
                    submission.status !== submission_entity_1.SubmissionStatus.REJECTED) {
                    this.logger.error(`Invalid status for State final reject: ${submission.status}. Expected: SUBMITTED_TO_STATE or REJECTED`);
                    throw new common_1.BadRequestException('Submission must be in SUBMITTED_TO_STATE or REJECTED status');
                }
            }
            if (userRole === user_entity_1.UserRole.MOSPI_APPROVER) {
                if (rejectDto.status !== submission_entity_1.SubmissionStatus.REJECTED_FINAL) {
                    this.logger.error(`Invalid target status for MoSPI: ${rejectDto.status}. Expected: REJECTED_FINAL`);
                    throw new common_1.BadRequestException('MoSPI final rejection must set status to REJECTED_FINAL');
                }
            }
            else if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
                if (rejectDto.status !== submission_entity_1.SubmissionStatus.REJECTED) {
                    this.logger.error(`Invalid target status for State: ${rejectDto.status}. Expected: REJECTED`);
                    throw new common_1.BadRequestException('State final rejection must set status to REJECTED');
                }
            }
            this.logger.log(`Processing final rejection with comment: ${rejectDto.comment}`);
            return this.dataSource.transaction(async (manager) => {
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: rejectDto.comment,
                    type: 'rejection',
                };
                this.logger.log(`Adding final rejection comment: ${rejectDto.comment}`);
                const updatedSubmission = await manager.save(submission_entity_1.Submission, {
                    ...submission,
                    status: rejectDto.status,
                    currentOwnerRole: this.getOwnerRoleFromStatus(rejectDto.status),
                    reviewComments: [...submission.reviewComments, comment],
                });
                this.logger.log(`Final rejection completed successfully`);
                this.logger.log(`Final Status: ${updatedSubmission.status}, Owner: ${updatedSubmission.currentOwnerRole}`);
                this.logger.log(`=== FINAL REJECT SUCCESS ===`);
                return updatedSubmission;
            });
        }
        catch (error) {
            this.logger.error(`=== FINAL REJECT ERROR ===`);
            this.logger.error(`Error performing final rejection on submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async resubmit(id, resubmitDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== RESUBMIT START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`ResubmitDto: ${JSON.stringify(resubmitDto)}`);
            if (userRole !== user_entity_1.UserRole.NODAL_OFFICER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: NODAL_OFFICER`);
                throw new common_1.ForbiddenException('Only Nodal Officers can resubmit');
            }
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (submission.submittedBy !== userId) {
                this.logger.error(`Invalid ownership. SubmittedBy: ${submission.submittedBy}, CurrentUser: ${userId}`);
                throw new common_1.ForbiddenException('Can only resubmit your own submissions');
            }
            if (submission.status !== submission_entity_1.SubmissionStatus.REJECTED) {
                this.logger.error(`Invalid status for resubmit: ${submission.status}. Expected: REJECTED`);
                throw new common_1.BadRequestException('Can only resubmit rejected submissions');
            }
            this.logger.log(`Processing resubmission with rejection count: ${submission.rejectionCount}`);
            return this.dataSource.transaction(async (manager) => {
                let updatedComments = submission.reviewComments;
                if (resubmitDto.comment) {
                    const comment = {
                        timestamp: new Date(),
                        role: userRole,
                        userId,
                        text: resubmitDto.comment,
                        type: 'comment',
                    };
                    updatedComments = [...updatedComments, comment];
                    this.logger.log(`Adding resubmission comment: ${resubmitDto.comment}`);
                }
                this.logger.log(`Updating submission status to: SUBMITTED_TO_STATE`);
                this.logger.log(`Updating owner role to: STATE_APPROVER`);
                this.logger.log(`Incrementing rejection count to: ${submission.rejectionCount + 1}`);
                await manager.update(submission_entity_1.Submission, id, {
                    status: submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                    currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                    rejectionCount: submission.rejectionCount + 1,
                    formData: resubmitDto.formData || submission.formData,
                    reviewComments: updatedComments,
                });
                this.logger.log(`Resubmission completed successfully`);
                this.logger.log(`Final Status: SUBMITTED_TO_STATE, Owner: STATE_APPROVER`);
                this.logger.log(`=== RESUBMIT SUCCESS ===`);
                return this.findOne(id, userRole, userStateUt);
            });
        }
        catch (error) {
            this.logger.error(`=== RESUBMIT ERROR ===`);
            this.logger.error(`Error resubmitting submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async approve(id, approveDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== APPROVE SUBMISSION START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`ApproveDto: ${JSON.stringify(approveDto)}`);
            if (userRole !== user_entity_1.UserRole.MOSPI_APPROVER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: MOSPI_APPROVER`);
                throw new common_1.ForbiddenException(`Only MoSPI Approvers can approve submissions. Current role: ${userRole}`);
            }
            if (!approveDto.status) {
                this.logger.error(`Missing status in payload`);
                throw new common_1.BadRequestException('Status is required in payload');
            }
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER) {
                this.logger.error(`Invalid current status: ${submission.status}. Expected: SUBMITTED_TO_MOSPI_APPROVER`);
                throw new common_1.BadRequestException(`Submission must be in SUBMITTED_TO_MOSPI_APPROVER status. Current status: ${submission.status}`);
            }
            if (approveDto.status !== submission_entity_1.SubmissionStatus.APPROVED) {
                this.logger.error(`Invalid target status: ${approveDto.status}. Expected: APPROVED`);
                throw new common_1.BadRequestException(`Approval must set status to APPROVED. Provided status: ${approveDto.status}`);
            }
            const comment = {
                timestamp: new Date(),
                role: userRole,
                userId,
                text: approveDto.comment || 'Submission approved',
                type: 'approval',
            };
            const updatedComments = [...submission.reviewComments, comment];
            this.logger.log(`Adding comment: ${approveDto.comment || 'Submission approved'}`);
            this.logger.log(`Updating submission with status: ${approveDto.status}`);
            const result = await this.dataSource.query(`UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $4
         RETURNING id, status, current_owner_role, review_comments`, [
                approveDto.status,
                this.getOwnerRoleFromStatus(approveDto.status),
                JSON.stringify(updatedComments),
                id,
            ]);
            this.logger.log(`Update result: ${JSON.stringify(result)}`);
            try {
                const finalScore = await this.scoringService.calculateScore(id, userId);
                this.logger.log(`Final score calculated successfully for submission: ${id}, Score: ${finalScore.totalScore}`);
            }
            catch (scoringError) {
                this.logger.error(`Scoring failed for submission ${id}: ${scoringError.message}`);
            }
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`=== APPROVE SUBMISSION SUCCESS ===`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`=== APPROVE SUBMISSION ERROR ===`);
            this.logger.error(`Error approving submission ${id}: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async addFileToSubmission(submissionId, file, userId, userRole, userStateUt) {
        const submission = await this.findOne(submissionId, userRole, userStateUt);
        if (userRole !== user_entity_1.UserRole.NODAL_OFFICER || submission.submittedBy !== userId) {
            throw new common_1.ForbiddenException('Only Nodal Officers can add files to their own submissions');
        }
        if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE) {
            throw new common_1.BadRequestException('Cannot add files to submission that has been forwarded to MoSPI');
        }
        const updatedFiles = [...submission.attachedFiles, file];
        await this.submissionRepository.update(submissionId, {
            attachedFiles: updatedFiles,
        });
        return this.findOne(submissionId, userRole, userStateUt);
    }
    async removeFileFromSubmission(submissionId, filePath, userId, userRole, userStateUt) {
        const submission = await this.findOne(submissionId, userRole, userStateUt);
        if (userRole !== user_entity_1.UserRole.NODAL_OFFICER || submission.submittedBy !== userId) {
            throw new common_1.ForbiddenException('Only Nodal Officers can remove files from their own submissions');
        }
        if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE) {
            throw new common_1.BadRequestException('Cannot remove files from submission that has been forwarded to MoSPI');
        }
        const updatedFiles = submission.attachedFiles.filter((file) => file.filePath !== filePath);
        await this.storageService.deleteFile(filePath);
        await this.submissionRepository.update(submissionId, {
            attachedFiles: updatedFiles,
        });
        return this.findOne(submissionId, userRole, userStateUt);
    }
    async getSubmissionFiles(submissionId, userRole, userStateUt) {
        const submission = await this.findOne(submissionId, userRole, userStateUt);
        return submission.attachedFiles;
    }
    async cleanupSubmissionFiles(submissionId) {
        try {
            const submission = await this.submissionRepository.findOne({
                where: { id: submissionId },
                select: ['attachedFiles'],
            });
            if (submission && submission.attachedFiles.length > 0) {
                const filePaths = submission.attachedFiles.map((file) => file.filePath);
                await this.storageService.deleteSubmissionFiles(submissionId, filePaths);
                this.logger.log(`Cleaned up ${filePaths.length} files for submission: ${submissionId}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to cleanup files for submission ${submissionId}: ${error.message}`);
        }
    }
    getOwnerRoleFromStatus(status) {
        switch (status) {
            case submission_entity_1.SubmissionStatus.DRAFT:
                return user_entity_1.UserRole.NODAL_OFFICER;
            case submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE:
                return user_entity_1.UserRole.STATE_APPROVER;
            case submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER:
                return user_entity_1.UserRole.MOSPI_REVIEWER;
            case submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER:
                return user_entity_1.UserRole.MOSPI_APPROVER;
            case submission_entity_1.SubmissionStatus.REJECTED:
                return user_entity_1.UserRole.NODAL_OFFICER;
            case submission_entity_1.SubmissionStatus.REJECTED_FINAL:
                return user_entity_1.UserRole.MOSPI_APPROVER;
            case submission_entity_1.SubmissionStatus.RETURNED_FROM_STATE:
                return user_entity_1.UserRole.NODAL_OFFICER;
            case submission_entity_1.SubmissionStatus.RETURNED_FROM_MOSPI:
                return user_entity_1.UserRole.NODAL_OFFICER;
            case submission_entity_1.SubmissionStatus.APPROVED:
                return user_entity_1.UserRole.MOSPI_APPROVER;
            default:
                return user_entity_1.UserRole.NODAL_OFFICER;
        }
    }
    async updateStatus(id, updateStatusDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`Updating status for submission ${id} to ${updateStatusDto.status} by user ${userId}`);
            const submission = await this.findOne(id, userRole, userStateUt);
            this.validateStatusTransition(submission.status, updateStatusDto.status, userRole);
            const newOwnerRole = this.getOwnerRoleFromStatus(updateStatusDto.status);
            let updatedComments = [...submission.reviewComments];
            if (updateStatusDto.comment) {
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: updateStatusDto.comment,
                    type: 'comment',
                };
                updatedComments.push(comment);
            }
            await this.submissionRepository.update(id, {
                status: updateStatusDto.status,
                currentOwnerRole: newOwnerRole,
                reviewComments: updatedComments,
            });
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Status updated successfully for submission ${id}`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`Error updating status for submission ${id}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async forwardToMoSPIReviewer(id, forwardDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`=== FORWARD TO MOSPI REVIEWER START ===`);
            this.logger.log(`ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`);
            this.logger.log(`ForwardDto: ${JSON.stringify(forwardDto)}`);
            if (userRole !== user_entity_1.UserRole.STATE_APPROVER) {
                this.logger.error(`Invalid user role: ${userRole}. Expected: STATE_APPROVER`);
                throw new common_1.ForbiddenException(`Only State Approvers can forward to MoSPI Reviewer. Current role: ${userRole}`);
            }
            if (!forwardDto.status) {
                this.logger.error(`Missing status in payload`);
                throw new common_1.BadRequestException('Status is required in payload');
            }
            this.logger.log(`Finding submission with ID: ${id}`);
            const submission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Found submission with status: ${submission.status}`);
            if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE) {
                this.logger.error(`Invalid status transition from ${submission.status} to ${forwardDto.status}`);
                throw new common_1.BadRequestException(`Submission must be in SUBMITTED_TO_STATE status to forward to MoSPI Reviewer. Current status: ${submission.status}`);
            }
            if (forwardDto.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER) {
                this.logger.error(`Invalid target status: ${forwardDto.status}`);
                throw new common_1.BadRequestException(`Invalid status for forwarding to MoSPI Reviewer. Expected: SUBMITTED_TO_MOSPI_REVIEWER, Got: ${forwardDto.status}`);
            }
            let updatedComments = [...submission.reviewComments];
            if (forwardDto.comment) {
                this.logger.log(`Adding comment: ${forwardDto.comment}`);
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: forwardDto.comment,
                    type: 'comment',
                };
                updatedComments.push(comment);
            }
            this.logger.log(`Updating submission with status: ${forwardDto.status}`);
            this.logger.log(`Review comments to update: ${JSON.stringify(updatedComments)}`);
            this.logger.log(`=== DATABASE UPDATE DATA ===`);
            this.logger.log(`Submission ID: ${id}`);
            this.logger.log(`Status: ${forwardDto.status}`);
            this.logger.log(`Current Owner Role: ${user_entity_1.UserRole.MOSPI_REVIEWER}`);
            this.logger.log(`Review Comments Count: ${updatedComments.length}`);
            this.logger.log(`Review Comments JSON: ${JSON.stringify(updatedComments)}`);
            const result = await this.dataSource.query(`UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $4
         RETURNING id, status, current_owner_role, review_comments`, [
                forwardDto.status,
                user_entity_1.UserRole.MOSPI_REVIEWER,
                JSON.stringify(updatedComments),
                id,
            ]);
            this.logger.log(`Update result: ${JSON.stringify(result)}`);
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`=== FORWARD TO MOSPI REVIEWER SUCCESS ===`);
            this.logger.log(`Updated submission status: ${updatedSubmission.status}`);
            this.logger.log(`Updated current owner role: ${updatedSubmission.currentOwnerRole}`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`=== FORWARD TO MOSPI REVIEWER ERROR ===`);
            this.logger.error(`Error forwarding submission ${id} to MoSPI Reviewer: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);
            throw error;
        }
    }
    async forwardToMoSPIApprover(id, forwardDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`Forwarding submission ${id} to MoSPI Approver by user ${userId}`);
            const submission = await this.findOne(id, userRole, userStateUt);
            if (submission.status !== submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER) {
                throw new common_1.BadRequestException(`Submission must be in SUBMITTED_TO_MOSPI_REVIEWER status to forward to MoSPI Approver. Current status: ${submission.status}`);
            }
            let updatedComments = [...submission.reviewComments];
            if (forwardDto.comment) {
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: forwardDto.comment,
                    type: 'comment',
                };
                updatedComments.push(comment);
            }
            await this.submissionRepository.update(id, {
                status: forwardDto.status,
                currentOwnerRole: user_entity_1.UserRole.MOSPI_APPROVER,
                reviewComments: updatedComments,
            });
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Submission ${id} forwarded to MoSPI Approver successfully`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`Error forwarding submission ${id} to MoSPI Approver: ${error.message}`, error.stack);
            throw error;
        }
    }
    async sendBackToState(id, sendBackDto, userId, userRole, userStateUt) {
        try {
            this.logger.log(`Sending submission ${id} back to state by user ${userId}`);
            const submission = await this.findOne(id, userRole, userStateUt);
            if (![
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            ].includes(submission.status)) {
                throw new common_1.BadRequestException(`Submission must be in MoSPI status to send back to state. Current status: ${submission.status}`);
            }
            let updatedComments = [...submission.reviewComments];
            if (sendBackDto.comment) {
                const comment = {
                    timestamp: new Date(),
                    role: userRole,
                    userId,
                    text: sendBackDto.comment,
                    type: 'comment',
                };
                updatedComments.push(comment);
            }
            await this.submissionRepository.update(id, {
                status: sendBackDto.status,
                currentOwnerRole: user_entity_1.UserRole.STATE_APPROVER,
                reviewComments: updatedComments,
                rejectionCount: () => 'rejection_count + 1',
            });
            const updatedSubmission = await this.findOne(id, userRole, userStateUt);
            this.logger.log(`Submission ${id} sent back to state successfully`);
            return updatedSubmission;
        }
        catch (error) {
            this.logger.error(`Error sending submission ${id} back to state: ${error.message}`, error.stack);
            throw error;
        }
    }
    validateStatusTransition(currentStatus, newStatus, userRole) {
        const validTransitions = {
            [submission_entity_1.SubmissionStatus.DRAFT]: [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE],
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE]: [
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                submission_entity_1.SubmissionStatus.REJECTED,
                submission_entity_1.SubmissionStatus.RETURNED_FROM_STATE,
            ],
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: [
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
            ],
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: [
                submission_entity_1.SubmissionStatus.APPROVED,
                submission_entity_1.SubmissionStatus.REJECTED_FINAL,
                submission_entity_1.SubmissionStatus.RETURNED_FROM_MOSPI,
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
            ],
            [submission_entity_1.SubmissionStatus.REJECTED]: [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE],
            [submission_entity_1.SubmissionStatus.RETURNED_FROM_STATE]: [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE],
            [submission_entity_1.SubmissionStatus.RETURNED_FROM_MOSPI]: [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE],
        };
        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            throw new common_1.BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}. Please check the workflow rules.`);
        }
    }
};
exports.SubmissionService = SubmissionService;
exports.SubmissionService = SubmissionService = SubmissionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(1, (0, typeorm_1.InjectRepository)(final_score_entity_1.FinalScore)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        scoring_service_1.ScoringService,
        storage_service_1.StorageService])
], SubmissionService);
//# sourceMappingURL=submission.service.js.map