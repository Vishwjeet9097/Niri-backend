import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Submission, SubmissionStatus } from "../../entities/submission.entity";
import { UserRole } from "../../entities/user.entity";

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
export interface DashboardCounts {
  nodal: {
    totalAssigned: number;
    totalIndicatorsReceived: number;
    acceptedFromNodal: number;
    pendingSubmission: number;
    returnedToNodal: number;
  };
  mospi: {
    submittedToMoSPI: number;
    returnedFromMoSPI: number;
    approvedByMoSPI: number;
  };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>
  ) {}

  async getDashboardSummary(
    userRole: UserRole,
    userStateUt: string
  ): Promise<DashboardSummary> {
    const baseQuery =
      this.submissionRepository.createQueryBuilder("submission");

    // Apply role-based filtering
    if (userRole === UserRole.NODAL_OFFICER) {
      baseQuery.andWhere("submission.stateUt = :stateUt", {
        stateUt: userStateUt,
      });
    } else if (userRole === UserRole.STATE_APPROVER) {
      baseQuery.andWhere("submission.stateUt = :stateUt", {
        stateUt: userStateUt,
      });
    }
    // MoSPI roles can see all submissions

    // Get counts by status
    const statusCounts = await baseQuery
      .clone()
      .select("submission.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("submission.status")
      .getRawMany();

    const submissionsByStatus = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      },
      {} as Record<SubmissionStatus, number>
    );

    // Calculate totals
    const pendingSubmissions =
      (submissionsByStatus[SubmissionStatus.SUBMITTED_TO_STATE] || 0) +
      (submissionsByStatus[SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER] || 0) +
      (submissionsByStatus[SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER] || 0);
    const approvedSubmissions =
      submissionsByStatus[SubmissionStatus.APPROVED] || 0;
    const rejectedSubmissions =
      (submissionsByStatus[SubmissionStatus.REJECTED] || 0) +
      (submissionsByStatus[SubmissionStatus.REJECTED_FINAL] || 0);
    const totalSubmissions =
      pendingSubmissions + approvedSubmissions + rejectedSubmissions;

    // Calculate average review time (in days)
    const reviewTimeQuery = await baseQuery
      .clone()
      .select(
        "AVG(EXTRACT(EPOCH FROM (submission.updatedAt - submission.createdAt))/86400)",
        "avgReviewTime"
      )
      .where("submission.status IN (:...statuses)", {
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
      .where("submission.status IN (:...statuses)", {
        statuses: [
          SubmissionStatus.SUBMITTED_TO_STATE,
          SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
        ],
      })
      .andWhere("submission.createdAt < :thirtyDaysAgo", { thirtyDaysAgo })
      .getCount();

    // Get submissions by month for the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyData = await baseQuery
      .clone()
      .select("TO_CHAR(submission.createdAt, 'YYYY-MM')", "month")
      .addSelect("COUNT(*)", "count")
      .where("submission.createdAt >= :twelveMonthsAgo", { twelveMonthsAgo })
      .groupBy("TO_CHAR(submission.createdAt, 'YYYY-MM')")
      .orderBy("month", "ASC")
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

  async getRoleSpecificKPIs(
    userRole: UserRole,
    userStateUt: string
  ): Promise<any> {
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

  async getRecentActivities(
    userRole: UserRole,
    userStateUt: string
  ): Promise<any[]> {
    const queryBuilder = this.submissionRepository
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.user", "user")
      .orderBy("submission.updatedAt", "DESC")
      .limit(10);

    // Apply role-based filtering
    if (
      userRole === UserRole.NODAL_OFFICER ||
      userRole === UserRole.STATE_APPROVER
    ) {
      // State users: अपने state के submissions दिखें जिनका status APPROVED या REJECTED_TO_STATE हो
      queryBuilder
        .where("submission.stateUt = :stateUt", { stateUt: userStateUt })
        .andWhere("submission.status IN (:...statuses)", {
          statuses: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED],
        });
    } else if (
      userRole === UserRole.MOSPI_REVIEWER ||
      userRole === UserRole.MOSPI_APPROVER
    ) {
      // MoSPI users: सभी submissions दिखें जिनका status APPROVED हो
      queryBuilder.where("submission.status = :status", {
        status: SubmissionStatus.APPROVED,
      });
    }

    const submissions = await queryBuilder.getMany();

    // Format response according to the UI requirements
    return submissions.map((submission) => ({
      id: submission.id,
      submissionId: submission.submissionId,
      title:
        submission.formData?.title ||
        submission.formData?.projectName ||
        "Submission",
      status: submission.status,
      statusLabel: this.getStatusLabel(submission.status),
      statusColor: this.getStatusColor(submission.status),
      stateUt: submission.stateUt,
      submittedBy: submission.user
        ? `${submission.user.firstName} ${submission.user.lastName}`
        : "Unknown",
      submittedByRole: submission.user?.role || "Unknown",
      updatedAt: submission.updatedAt,
      createdAt: submission.createdAt,
    }));
  }

  private getStatusLabel(status: SubmissionStatus): string {
    const statusLabels = {
      [SubmissionStatus.APPROVED]: "Approved",
      [SubmissionStatus.REJECTED]: "Returned",
      [SubmissionStatus.REJECTED_FINAL]: "Rejected",
      [SubmissionStatus.SUBMITTED_TO_STATE]: "Submitted to State",
      [SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]:
        "Submitted to MoSPI Reviewer",
      [SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]:
        "Submitted to MoSPI Approver",
      [SubmissionStatus.DRAFT]: "Draft",
    };
    return statusLabels[status] || status;
  }

  private getStatusColor(status: SubmissionStatus): string {
    const statusColors = {
      [SubmissionStatus.APPROVED]: "green",
      [SubmissionStatus.REJECTED]: "orange",
      [SubmissionStatus.REJECTED_FINAL]: "red",
      [SubmissionStatus.SUBMITTED_TO_STATE]: "blue",
      [SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: "blue",
      [SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: "blue",
      [SubmissionStatus.DRAFT]: "gray",
    };
    return statusColors[status] || "gray";
  }

  async getStateApproverDashboardCounts(
    userRole: UserRole,
    userStateUt: string
  ): Promise<DashboardCounts> {
    // ✅ 1. Total indicators assigned to Nodal Officers in this state
    const totalAssigned = await this.submissionRepository.query(
      `
    SELECT COUNT(DISTINCT uis.indicator_id) AS count
    FROM user_indicator_scope uis
    JOIN users u ON uis.user_id = u.id
    WHERE u.role = $1 
      AND u.state_ut = $2
    `,
      [UserRole.NODAL_OFFICER, userStateUt]
    );
    const totalAssignedCount = parseInt(totalAssigned[0]?.count || "0");

    // ✅ 2. Total indicators received
    const totalIndicatorsReceivedQuery = await this.submissionRepository.query(
      `
    SELECT COUNT(DISTINCT uis.indicator_id) AS count
    FROM user_indicator_scope uis
    JOIN users u ON uis.user_id = u.id
    WHERE u.role = $1 
      AND u.state_ut = $2
    `,
      [UserRole.NODAL_OFFICER, userStateUt]
    );
    const totalIndicatorsReceived = parseInt(
      totalIndicatorsReceivedQuery[0]?.count || "0"
    );

    // ✅ 3. Count submission statuses (top-level)
    const statusCounts = await this.submissionRepository
      .createQueryBuilder("submission")
      .select("submission.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("submission.stateUt = :stateUt", { stateUt: userStateUt })
      .groupBy("submission.status")
      .getRawMany();

    const byStatus = statusCounts.reduce(
      (acc, item) => ({ ...acc, [item.status]: parseInt(item.count) }),
      {} as Record<string, number>
    );

    // ✅ 4. Count Accepted indicators (from JSON)
    let acceptedFromNodal = 0;
    try {
      const acceptedCountQuery = await this.submissionRepository.query(
        `
      SELECT COALESCE(SUM(cnt), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM jsonb_array_elements_text(
            jsonb_path_query_array(s.form_data, '$.**.status')
          ) AS st(val)
          WHERE st.val = 'ACCEPTED'
        ) AS cnt
        FROM submissions s
        WHERE s."stateUt" = $1
      ) t;
      `,
        [userStateUt]
      );
      acceptedFromNodal = parseInt(acceptedCountQuery[0]?.count || "0");
    } catch {
      const fallback = await this.submissionRepository.query(
        `
      SELECT COALESCE(SUM(matches), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM regexp_matches(s.form_data::text, '"status"\\s*:\\s*"ACCEPTED"', 'g')
        ) AS matches
        FROM submissions s
        WHERE s."stateUt" = $1
      ) t;
      `,
        [userStateUt]
      );
      acceptedFromNodal = parseInt(fallback[0]?.count || "0");
    }

    // ✅ 5. Count Reverted indicators (from JSON)
    let returnedToNodal = 0;
    try {
      const revertedCountQuery = await this.submissionRepository.query(
        `
      SELECT COALESCE(SUM(cnt), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM jsonb_array_elements_text(
            jsonb_path_query_array(s.form_data, '$.**.status')
          ) AS st(val)
          WHERE st.val = 'REVERTED'
        ) AS cnt
        FROM submissions s
        WHERE s."stateUt" = $1
      ) t;
      `,
        [userStateUt]
      );
      returnedToNodal = parseInt(revertedCountQuery[0]?.count || "0");
    } catch {
      const fallback = await this.submissionRepository.query(
        `
      SELECT COALESCE(SUM(matches), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM regexp_matches(s.form_data::text, '"status"\\s*:\\s*"REVERTED"', 'g')
        ) AS matches
        FROM submissions s
        WHERE s."stateUt" = $1
      ) t;
      `,
        [userStateUt]
      );
      returnedToNodal = parseInt(fallback[0]?.count || "0");
    }

    // ✅ 6. Pending = Assigned but not yet submitted
    const pendingSubmission = Math.max(
      totalAssignedCount - totalIndicatorsReceived,
      0
    );

    // ✅ 7. MoSPI metrics (same)
    const submittedToMoSPI =
      (byStatus[SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER] || 0) +
      (byStatus[SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER] || 0);
    const returnedFromMoSPI =
      byStatus[SubmissionStatus.RETURNED_FROM_MOSPI] || 0;
    const approvedByMoSPI = byStatus[SubmissionStatus.APPROVED] || 0;

    // ✅ 8. Return final structured response
    return {
      nodal: {
        totalAssigned: totalAssignedCount,
        totalIndicatorsReceived,
        acceptedFromNodal,
        pendingSubmission,
        returnedToNodal,
      },
      mospi: {
        submittedToMoSPI,
        returnedFromMoSPI,
        approvedByMoSPI,
      },
    };
  }

async getNodalOfficerDashboardCounts(userId: string): Promise<{
  totalAssigned: number;
  totalSubmitted: number;
  approved: number;
  reverted: number;
  underReview: number;
  pendingSubmission: number;
}> {
  this.logger.log(`[NodalDashboard] Computing metrics based on section.status for userId=${userId}`);

  // 1️⃣ Total indicators assigned to this Nodal Officer
  const totalAssignedRes = await this.submissionRepository.query(
    `
    SELECT COUNT(DISTINCT uis.indicator_id) AS count
    FROM user_indicator_scope uis
    WHERE uis.user_id = $1
    `,
    [userId]
  );
  const totalAssigned = parseInt(totalAssignedRes[0]?.count || "0");
  this.logger.log(`[NodalDashboard] totalAssigned = ${totalAssigned}`);

  // 2️⃣ Total Submitted (any section that has a "status" key)
  let totalSubmitted = 0;
  try {
    const totalSubmittedQuery = await this.submissionRepository.query(
      `
      SELECT COALESCE(SUM(cnt), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM jsonb_array_elements_text(
            jsonb_path_query_array(s.form_data, '$.**.status')
          ) AS st(val)
        ) AS cnt
        FROM submissions s
        WHERE s.submitted_by = $1
      ) t;
      `,
      [userId]
    );
    totalSubmitted = parseInt(totalSubmittedQuery[0]?.count || "0");
  } catch (err) {
    this.logger.warn(`[NodalDashboard] JSONPath failed for totalSubmitted, falling back to regex`);
    const fallback = await this.submissionRepository.query(
      `
      SELECT COALESCE(SUM(matches), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM regexp_matches(s.form_data::text, '"status"\\s*:\\s*"', 'g')
        ) AS matches
        FROM submissions s
        WHERE s.submitted_by = $1
      ) t;
      `,
      [userId]
    );
    totalSubmitted = parseInt(fallback[0]?.count || "0");
  }
  this.logger.log(`[NodalDashboard] totalSubmitted sections = ${totalSubmitted}`);

  // 3️⃣ Approved sections (status = "ACCEPTED")
  let approved = 0;
  try {
    const approvedQuery = await this.submissionRepository.query(
      `
      SELECT COALESCE(SUM(cnt), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM jsonb_array_elements_text(
            jsonb_path_query_array(s.form_data, '$.**.status')
          ) AS st(val)
          WHERE st.val = 'ACCEPTED'
        ) AS cnt
        FROM submissions s
        WHERE s.submitted_by = $1
      ) t;
      `,
      [userId]
    );
    approved = parseInt(approvedQuery[0]?.count || "0");
  } catch {
    const fallback = await this.submissionRepository.query(
      `
      SELECT COALESCE(SUM(matches), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM regexp_matches(s.form_data::text, '"status"\\s*:\\s*"ACCEPTED"', 'g')
        ) AS matches
        FROM submissions s
        WHERE s.submitted_by = $1
      ) t;
      `,
      [userId]
    );
    approved = parseInt(fallback[0]?.count || "0");
  }
  this.logger.log(`[NodalDashboard] approved sections (status=ACCEPTED) = ${approved}`);

  // 4️⃣ Reverted sections (status = "REVERTED")
  let reverted = 0;
  try {
    const revertedQuery = await this.submissionRepository.query(
      `
      SELECT COALESCE(SUM(cnt), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM jsonb_array_elements_text(
            jsonb_path_query_array(s.form_data, '$.**.status')
          ) AS st(val)
          WHERE st.val = 'REVERTED'
        ) AS cnt
        FROM submissions s
        WHERE s.submitted_by = $1
      ) t;
      `,
      [userId]
    );
    reverted = parseInt(revertedQuery[0]?.count || "0");
  } catch {
    const fallback = await this.submissionRepository.query(
      `
      SELECT COALESCE(SUM(matches), 0) AS count FROM (
        SELECT (
          SELECT COUNT(*) FROM regexp_matches(s.form_data::text, '"status"\\s*:\\s*"REVERTED"', 'g')
        ) AS matches
        FROM submissions s
        WHERE s.submitted_by = $1
      ) t;
      `,
      [userId]
    );
    reverted = parseInt(fallback[0]?.count || "0");
  }
  this.logger.log(`[NodalDashboard] reverted sections (status=REVERTED) = ${reverted}`);

  // 5️⃣ Under Review = submitted - (accepted + reverted)
  const underReview = Math.max(totalSubmitted - approved - reverted, 0);

  // 6️⃣ Pending = assigned - submitted
  const pendingSubmission = Math.max(totalAssigned - totalSubmitted, 0);

  this.logger.log(
    `[NodalDashboard] Final => totalAssigned=${totalAssigned}, totalSubmitted=${totalSubmitted}, approved=${approved}, reverted=${reverted}, underReview=${underReview}, pendingSubmission=${pendingSubmission}`
  );

  return {
    totalAssigned,
    totalSubmitted,
    approved,
    reverted,
    underReview,
    pendingSubmission,
  };
}

}
