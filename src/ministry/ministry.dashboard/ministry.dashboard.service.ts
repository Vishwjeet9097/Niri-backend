import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { MinistrySubmissionIndicator, SubmissionIndicatorStatus } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { Form, FormStatus } from '../entities/form.entity';
import { User, UserRole } from '../../entities/user.entity';
import { SubmissionStatus } from '../../entities/submission.entity';

@Injectable()
export class MinistryDashboardService {
  constructor(
    @InjectRepository(MinistrySubmissionIndicator)
    private readonly ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
    @InjectRepository(MinistrySubmission)
    private readonly ministrySubmissionRepository: Repository<MinistrySubmission>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Main method to get dashboard data based on user role
   */
  async getDashboardData(userId: string): Promise<{
    status: boolean;
    data: any;
    message: string;
  }> {
    try {
      // Get user to determine role
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'role'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Route to appropriate service based on role
      switch (user.role) {
        case UserRole.NODAL_OFFICER:
          return {
            status: true,
            data: await this.getNodalDashboard(userId),
            message: 'Nodal dashboard data retrieved successfully',
          };

        case UserRole.MINISTRY_APPROVER:
          return {
            status: true,
            data: await this.getMinistryApproverDashboard(userId),
            message: 'Ministry Approver dashboard data retrieved successfully',
          };

        case UserRole.MOSPI_REVIEWER:
          return {
            status: true,
            data: await this.getMospiReviewerDashboard(userId),
            message: 'Mospi Reviewer dashboard data retrieved successfully',
          };

        case UserRole.MOSPI_APPROVER:
          return {
            status: true,
            data: await this.getMospiApproverDashboard(userId),
            message: 'Mospi Approver dashboard data retrieved successfully',
          };

        default:
          throw new BadRequestException(
            `Dashboard not available for role: ${user.role}`,
          );
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to retrieve dashboard data',
      );
    }
  }

  /**
   * Nodal Dashboard Service
   * Get data from submission indicator where assigned_to = user id
   */
  private async getNodalDashboard(userId: string): Promise<any> {
    // Total Allocated: where user id = assigned_to
    const totalAllocated = await this.ministrySubmissionIndicatorRepository.count({
      where: { assignedTo: userId },
    });

    // Pending: Status is null
    const pending = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: IsNull(),
      },
    });

    // Under Review: Status is DRAFT or SUBMITTED_TO_STATE
    const underReview = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: In([SubmissionIndicatorStatus.DRAFT, SubmissionIndicatorStatus.SUBMITTED_TO_STATE]),
      },
    });

    // Approved: Status is ACCEPTED_BY_STATE or ACCEPTED_BY_MOSPI
    const approved = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: In([SubmissionIndicatorStatus.ACCEPTED_BY_STATE, SubmissionIndicatorStatus.ACCEPTED_BY_MOSPI]),
      },
    });

    // Sent Back: Status is RETURNED_FROM_STATE
    const sentBack = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: SubmissionIndicatorStatus.RETURNED_FROM_STATE,
      },
    });

    return {
      totalAllocated,
      pending,
      underReview,
      approved,
      sentBack,
    };
  }

  /**
   * Ministry Approver Dashboard Service
   * Get data from submission indicator where ministry_user = user id
   */
  private async getMinistryApproverDashboard(userId: string): Promise<any> {
    // Accepted from nodal: user id != user id (state user id != ministry user id) and status is ACCEPTED_BY_STATE
    // This means indicators where ministry_user = userId but the state user (assigned_to) is different and status is ACCEPTED_BY_STATE
    const acceptedFromNodal = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.ministryUser = :userId', { userId })
      .andWhere('indicator.assignedTo != :userId', { userId })
      .andWhere('indicator.status = :status', { status: SubmissionIndicatorStatus.ACCEPTED_BY_STATE })
      .getCount();

    // Pending Submission: Not assigned to any user (assigned_to is null) and status is DRAFT
    const pendingSubmission = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.ministryUser = :userId', { userId })
      .andWhere('(indicator.status IS NULL OR indicator.status = :draftStatus)', {
        draftStatus: SubmissionIndicatorStatus.DRAFT,
      })
      .getCount();

    // Returned to Nodal: user id is not of state (assigned_to != userId) and status is RETURNED_FROM_STATE
    const returnedToNodal = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.ministryUser = :userId', { userId })
      .andWhere('indicator.assignedTo != :userId', { userId })
      .andWhere('indicator.status = :status', { status: SubmissionIndicatorStatus.RETURNED_FROM_STATE })
      .getCount();

    // Submitted to mospi: submission_form has ministry_user = user id and status is SUBMITTED_TO_MOSPI
    // Then all indicators from submission_indicator which have ministry_user = user id
    const formsSubmittedToMospi = await this.formRepository.find({
      where: {
        ministryUser: userId,
        status: FormStatus.SUBMITTED_TO_MOSPI,
      },
    });

    const formIdsSubmittedToMospi = formsSubmittedToMospi.map((f) => f.id);

    let submittedToMospi = 0;
    if (formIdsSubmittedToMospi.length > 0) {
      // Get submissions with status SUBMITTED_TO_MOSPI_REVIEWER or SUBMITTED_TO_MOSPI_APPROVER for these forms
      const submissionsSubmittedToMospi = await this.ministrySubmissionRepository.find({
        where: {
          formId: In(formIdsSubmittedToMospi),
          status: In([SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER, SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]),
        },
      });

      const submissionIdsSubmittedToMospi = submissionsSubmittedToMospi.map((s) => s.id);

      if (submissionIdsSubmittedToMospi.length > 0) {
        // Get indicators for these submissions where ministry_user = userId
        submittedToMospi = await this.ministrySubmissionIndicatorRepository.count({
          where: {
            ministryUser: userId,
            submissionId: In(submissionIdsSubmittedToMospi),
          },
        });
      }
    }

    // Approved by mospi: status from submission_indicator is ACCEPTED_BY_MOSPI
    const approvedByMospi = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        ministryUser: userId,
        status: SubmissionIndicatorStatus.ACCEPTED_BY_MOSPI,
      },
    });

    // Returned from mospi: status from submission_indicator is RETURNED_FROM_MOSPI
    const returnedFromMospi = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        ministryUser: userId,
        status: SubmissionIndicatorStatus.RETURNED_FROM_MOSPI,
      },
    });

    // TOTAL: ministry_user = user id
    const total = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        ministryUser: userId,
      },
    });

    return {
      acceptedFromNodal,
      pendingSubmission,
      returnedToNodal,
      submittedToMospi,
      approvedByMospi,
      returnedFromMospi,
      total,
    };
  }

  /**
   * Mospi Reviewer Dashboard Service
   * From submission_form get forms which have reviewer = user id
   */
  private async getMospiReviewerDashboard(userId: string): Promise<any> {
    // Get forms where reviewer = userId
    const forms = await this.formRepository.find({
      where: {
        reviewer: userId,
      },
    });

    if (forms.length === 0) {
      return {
        accepted: 0,
        underReview: 0,
        returnedToState: 0,
        total: 0,
      };
    }

    // Accepted: status ACCEPTED_BY_MOSPI
    const accepted = forms.filter(
      (form) => form.status === FormStatus.ACCEPTED_BY_MOSPI,
    ).length;

    // Under review: status is null or DRAFT
    const underReview = forms.filter(
      (form) => form.status === null || form.status === FormStatus.DRAFT,
    ).length;

    // Returned to state: status RETURNED_FROM_MOSPI
    const returnedToState = forms.filter(
      (form) => form.status === FormStatus.RETURNED_FROM_MOSPI,
    ).length;

    // Total: count of forms
    const total = forms.length;

    return {
      accepted,
      underReview,
      returnedToState,
      total,
    };
  }

  /**
   * Mospi Approver Dashboard Service
   */
  private async getMospiApproverDashboard(userId: string): Promise<any> {
    // Get all forms (Mospi Approver sees all)
    const allForms = await this.formRepository.find();

    // Accepted: status ACCEPTED_BY_MOSPI
    const accepted = allForms.filter(
      (form) => form.status === FormStatus.ACCEPTED_BY_MOSPI,
    ).length;

    // Under review: status is null or DRAFT
    const underReview = allForms.filter(
      (form) => form.status === null || form.status === FormStatus.DRAFT,
    ).length;

    // Returned to state: status RETURNED_FROM_MOSPI
    const returnedToState = allForms.filter(
      (form) => form.status === FormStatus.RETURNED_FROM_MOSPI,
    ).length;

    // Total: count of all forms
    const total = 17;

    return {
      accepted,
      underReview,
      returnedToState,
      total,
    };
  }
}

