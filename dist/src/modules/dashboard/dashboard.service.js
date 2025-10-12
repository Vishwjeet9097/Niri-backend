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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("../../entities/submission.entity");
const user_entity_1 = require("../../entities/user.entity");
let DashboardService = class DashboardService {
    constructor(submissionRepository) {
        this.submissionRepository = submissionRepository;
    }
    async getDashboardSummary(userRole, userStateUt) {
        const baseQuery = this.submissionRepository.createQueryBuilder('submission');
        if (userRole === user_entity_1.UserRole.NODAL_OFFICER) {
            baseQuery.andWhere('submission.stateUt = :stateUt', { stateUt: userStateUt });
        }
        else if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
            baseQuery.andWhere('submission.stateUt = :stateUt', { stateUt: userStateUt });
        }
        const statusCounts = await baseQuery
            .clone()
            .select('submission.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('submission.status')
            .getRawMany();
        const submissionsByStatus = statusCounts.reduce((acc, item) => {
            acc[item.status] = parseInt(item.count);
            return acc;
        }, {});
        const pendingSubmissions = (submissionsByStatus[submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE] || 0) +
            (submissionsByStatus[submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER] || 0) +
            (submissionsByStatus[submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER] || 0);
        const approvedSubmissions = submissionsByStatus[submission_entity_1.SubmissionStatus.APPROVED] || 0;
        const rejectedSubmissions = (submissionsByStatus[submission_entity_1.SubmissionStatus.REJECTED] || 0) +
            (submissionsByStatus[submission_entity_1.SubmissionStatus.REJECTED_FINAL] || 0);
        const totalSubmissions = pendingSubmissions + approvedSubmissions + rejectedSubmissions;
        const reviewTimeQuery = await baseQuery
            .clone()
            .select('AVG(EXTRACT(EPOCH FROM (submission.updatedAt - submission.createdAt))/86400)', 'avgReviewTime')
            .where('submission.status IN (:...statuses)', {
            statuses: [submission_entity_1.SubmissionStatus.APPROVED, submission_entity_1.SubmissionStatus.REJECTED_FINAL],
        })
            .getRawOne();
        const averageReviewTime = reviewTimeQuery?.avgReviewTime
            ? Math.round(parseFloat(reviewTimeQuery.avgReviewTime) * 100) / 100
            : 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const overdueCount = await baseQuery
            .clone()
            .where('submission.status IN (:...statuses)', {
            statuses: [
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE,
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
                submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            ],
        })
            .andWhere('submission.createdAt < :thirtyDaysAgo', { thirtyDaysAgo })
            .getCount();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const monthlyData = await baseQuery
            .clone()
            .select("TO_CHAR(submission.createdAt, 'YYYY-MM')", 'month')
            .addSelect('COUNT(*)', 'count')
            .where('submission.createdAt >= :twelveMonthsAgo', { twelveMonthsAgo })
            .groupBy("TO_CHAR(submission.createdAt, 'YYYY-MM')")
            .orderBy('month', 'ASC')
            .getRawMany();
        const submissionsByMonth = monthlyData.map((item) => ({
            month: item.month,
            count: parseInt(item.count),
        }));
        return {
            pendingSubmissions,
            approvedSubmissions,
            rejectedSubmissions,
            totalSubmissions,
            averageReviewTime,
            overdueSubmissions: overdueCount,
            submissionsByStatus,
            submissionsByMonth,
        };
    }
    async getRoleSpecificKPIs(userRole, userStateUt) {
        const summary = await this.getDashboardSummary(userRole, userStateUt);
        const roleSpecificKPIs = {
            [user_entity_1.UserRole.NODAL_OFFICER]: {
                mySubmissions: summary.totalSubmissions,
                pendingReview: summary.pendingSubmissions,
                approved: summary.approvedSubmissions,
                rejected: summary.rejectedSubmissions,
                averageReviewTime: summary.averageReviewTime,
            },
            [user_entity_1.UserRole.STATE_APPROVER]: {
                pendingReview: summary.pendingSubmissions,
                approved: summary.approvedSubmissions,
                rejected: summary.rejectedSubmissions,
                overdue: summary.overdueSubmissions,
                averageReviewTime: summary.averageReviewTime,
            },
            [user_entity_1.UserRole.MOSPI_REVIEWER]: {
                pendingReview: summary.pendingSubmissions,
                approved: summary.approvedSubmissions,
                rejected: summary.rejectedSubmissions,
                overdue: summary.overdueSubmissions,
                averageReviewTime: summary.averageReviewTime,
            },
            [user_entity_1.UserRole.MOSPI_APPROVER]: {
                pendingApproval: summary.pendingSubmissions,
                approved: summary.approvedSubmissions,
                rejected: summary.rejectedSubmissions,
                overdue: summary.overdueSubmissions,
                averageReviewTime: summary.averageReviewTime,
            },
        };
        return roleSpecificKPIs[userRole] || {};
    }
    async getRecentActivities(userRole, userStateUt) {
        const queryBuilder = this.submissionRepository
            .createQueryBuilder('submission')
            .leftJoinAndSelect('submission.user', 'user')
            .orderBy('submission.updatedAt', 'DESC')
            .limit(10);
        if (userRole === user_entity_1.UserRole.NODAL_OFFICER || userRole === user_entity_1.UserRole.STATE_APPROVER) {
            queryBuilder
                .where('submission.stateUt = :stateUt', { stateUt: userStateUt })
                .andWhere('submission.status IN (:...statuses)', {
                statuses: [submission_entity_1.SubmissionStatus.APPROVED, submission_entity_1.SubmissionStatus.REJECTED],
            });
        }
        else if (userRole === user_entity_1.UserRole.MOSPI_REVIEWER || userRole === user_entity_1.UserRole.MOSPI_APPROVER) {
            queryBuilder.where('submission.status = :status', { status: submission_entity_1.SubmissionStatus.APPROVED });
        }
        const submissions = await queryBuilder.getMany();
        return submissions.map((submission) => ({
            id: submission.id,
            submissionId: submission.submissionId,
            title: submission.formData?.title || submission.formData?.projectName || 'Submission',
            status: submission.status,
            statusLabel: this.getStatusLabel(submission.status),
            statusColor: this.getStatusColor(submission.status),
            stateUt: submission.stateUt,
            submittedBy: submission.user
                ? `${submission.user.firstName} ${submission.user.lastName}`
                : 'Unknown',
            submittedByRole: submission.user?.role || 'Unknown',
            updatedAt: submission.updatedAt,
            createdAt: submission.createdAt,
        }));
    }
    getStatusLabel(status) {
        const statusLabels = {
            [submission_entity_1.SubmissionStatus.APPROVED]: 'Approved',
            [submission_entity_1.SubmissionStatus.REJECTED]: 'Returned',
            [submission_entity_1.SubmissionStatus.REJECTED_FINAL]: 'Rejected',
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE]: 'Submitted to State',
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: 'Submitted to MoSPI Reviewer',
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: 'Submitted to MoSPI Approver',
            [submission_entity_1.SubmissionStatus.DRAFT]: 'Draft',
        };
        return statusLabels[status] || status;
    }
    getStatusColor(status) {
        const statusColors = {
            [submission_entity_1.SubmissionStatus.APPROVED]: 'green',
            [submission_entity_1.SubmissionStatus.REJECTED]: 'orange',
            [submission_entity_1.SubmissionStatus.REJECTED_FINAL]: 'red',
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_STATE]: 'blue',
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: 'blue',
            [submission_entity_1.SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: 'blue',
            [submission_entity_1.SubmissionStatus.DRAFT]: 'gray',
        };
        return statusColors[status] || 'gray';
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map