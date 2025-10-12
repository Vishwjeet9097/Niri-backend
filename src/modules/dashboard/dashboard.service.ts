import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from '../../entities/submission.entity';
import { UserRole } from '../../entities/user.entity';

export interface DashboardSummary {
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  totalSubmissions: number;
  averageReviewTime: number;
  overdueSubmissions: number;
  submissionsByStatus: Record<SubmissionStatus, number>;
  submissionsByMonth: Array<{ month: string; count: number }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
  ) {}

  async getDashboardSummary(userRole: UserRole, userStateUt: string): Promise<DashboardSummary> {
    const baseQuery = this.submissionRepository.createQueryBuilder('submission');

    // Apply role-based filtering
    if (userRole === UserRole.NODAL_OFFICER) {
      baseQuery.andWhere('submission.stateUt = :stateUt', { stateUt: userStateUt });
    } else if (userRole === UserRole.STATE_APPROVER) {
      baseQuery.andWhere('submission.stateUt = :stateUt', { stateUt: userStateUt });
    }
    // MoSPI roles can see all submissions

    // Get counts by status
    const statusCounts = await baseQuery
      .clone()
      .select('submission.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('submission.status')
      .getRawMany();

    const submissionsByStatus = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      },
      {} as Record<SubmissionStatus, number>,
    );

    // Calculate totals
    const pendingSubmissions =
      (submissionsByStatus[SubmissionStatus.SUBMITTED_TO_STATE] || 0) +
      (submissionsByStatus[SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER] || 0) +
      (submissionsByStatus[SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER] || 0);
    const approvedSubmissions = submissionsByStatus[SubmissionStatus.APPROVED] || 0;
    const rejectedSubmissions =
      (submissionsByStatus[SubmissionStatus.REJECTED] || 0) +
      (submissionsByStatus[SubmissionStatus.REJECTED_FINAL] || 0);
    const totalSubmissions = pendingSubmissions + approvedSubmissions + rejectedSubmissions;

    // Calculate average review time (in days)
    const reviewTimeQuery = await baseQuery
      .clone()
      .select(
        'AVG(EXTRACT(EPOCH FROM (submission.updatedAt - submission.createdAt))/86400)',
        'avgReviewTime',
      )
      .where('submission.status IN (:...statuses)', {
        statuses: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED_FINAL],
      })
      .getRawOne();

    const averageReviewTime = reviewTimeQuery?.avgReviewTime
      ? Math.round(parseFloat(reviewTimeQuery.avgReviewTime) * 100) / 100
      : 0;

    // Calculate overdue submissions (submissions pending for more than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueCount = await baseQuery
      .clone()
      .where('submission.status IN (:...statuses)', {
        statuses: [
          SubmissionStatus.SUBMITTED_TO_STATE,
          SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
        ],
      })
      .andWhere('submission.createdAt < :thirtyDaysAgo', { thirtyDaysAgo })
      .getCount();

    // Get submissions by month for the last 12 months
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

  async getRoleSpecificKPIs(userRole: UserRole, userStateUt: string): Promise<any> {
    const summary = await this.getDashboardSummary(userRole, userStateUt);

    const roleSpecificKPIs = {
      [UserRole.NODAL_OFFICER]: {
        mySubmissions: summary.totalSubmissions,
        pendingReview: summary.pendingSubmissions,
        approved: summary.approvedSubmissions,
        rejected: summary.rejectedSubmissions,
        averageReviewTime: summary.averageReviewTime,
      },
      [UserRole.STATE_APPROVER]: {
        pendingReview: summary.pendingSubmissions,
        approved: summary.approvedSubmissions,
        rejected: summary.rejectedSubmissions,
        overdue: summary.overdueSubmissions,
        averageReviewTime: summary.averageReviewTime,
      },
      [UserRole.MOSPI_REVIEWER]: {
        pendingReview: summary.pendingSubmissions,
        approved: summary.approvedSubmissions,
        rejected: summary.rejectedSubmissions,
        overdue: summary.overdueSubmissions,
        averageReviewTime: summary.averageReviewTime,
      },
      [UserRole.MOSPI_APPROVER]: {
        pendingApproval: summary.pendingSubmissions,
        approved: summary.approvedSubmissions,
        rejected: summary.rejectedSubmissions,
        overdue: summary.overdueSubmissions,
        averageReviewTime: summary.averageReviewTime,
      },
    };

    return roleSpecificKPIs[userRole] || {};
  }

  async getRecentActivities(userRole: UserRole, userStateUt: string): Promise<any[]> {
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.user', 'user')
      .orderBy('submission.updatedAt', 'DESC')
      .limit(10);

    // Apply role-based filtering
    if (userRole === UserRole.NODAL_OFFICER || userRole === UserRole.STATE_APPROVER) {
      // State users: अपने state के submissions दिखें जिनका status APPROVED या REJECTED_TO_STATE हो
      queryBuilder
        .where('submission.stateUt = :stateUt', { stateUt: userStateUt })
        .andWhere('submission.status IN (:...statuses)', {
          statuses: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED],
        });
    } else if (userRole === UserRole.MOSPI_REVIEWER || userRole === UserRole.MOSPI_APPROVER) {
      // MoSPI users: सभी submissions दिखें जिनका status APPROVED हो
      queryBuilder.where('submission.status = :status', { status: SubmissionStatus.APPROVED });
    }

    const submissions = await queryBuilder.getMany();

    // Format response according to the UI requirements
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

  private getStatusLabel(status: SubmissionStatus): string {
    const statusLabels = {
      [SubmissionStatus.APPROVED]: 'Approved',
      [SubmissionStatus.REJECTED]: 'Returned',
      [SubmissionStatus.REJECTED_FINAL]: 'Rejected',
      [SubmissionStatus.SUBMITTED_TO_STATE]: 'Submitted to State',
      [SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: 'Submitted to MoSPI Reviewer',
      [SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: 'Submitted to MoSPI Approver',
      [SubmissionStatus.DRAFT]: 'Draft',
    };
    return statusLabels[status] || status;
  }

  private getStatusColor(status: SubmissionStatus): string {
    const statusColors = {
      [SubmissionStatus.APPROVED]: 'green',
      [SubmissionStatus.REJECTED]: 'orange',
      [SubmissionStatus.REJECTED_FINAL]: 'red',
      [SubmissionStatus.SUBMITTED_TO_STATE]: 'blue',
      [SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: 'blue',
      [SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: 'blue',
      [SubmissionStatus.DRAFT]: 'gray',
    };
    return statusColors[status] || 'gray';
  }
}
