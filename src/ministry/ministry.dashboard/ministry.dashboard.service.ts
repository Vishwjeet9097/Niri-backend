import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { MinistrySubmissionIndicator, SubmissionIndicatorStatus } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { Form, FormStatus } from '../entities/form.entity';
import { User, UserRole } from '../../entities/user.entity';
import { MinistrySubmissionStatus } from '../entities/ministry-submission.entity';
import { Ministry } from '../../entities/ministry.entity';

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
    @InjectRepository(Ministry)
    private readonly ministryRepository: Repository<Ministry>,
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

    // Under Review: Status is DRAFT or SUBMITTED_TO_MINISTRY
    const underReview = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: In([SubmissionIndicatorStatus.DRAFT, SubmissionIndicatorStatus.SUBMITTED_TO_MINISTRY]),
      },
    });

    // Approved: Status is ACCEPTED_BY_MINISTRY or ACCEPTED_BY_MOSPI
    const approved = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: In([SubmissionIndicatorStatus.ACCEPTED_BY_MINISTRY, SubmissionIndicatorStatus.ACCEPTED_BY_MOSPI]),
      },
    });

    // Sent Back: Status is RETURNED_FROM_MINISTRY
    const sentBack = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
        status: SubmissionIndicatorStatus.RETURNED_FROM_MINISTRY,
      },
    });

    // Total Submitted: assigned_to = userId and status is not null
    const total_submitted = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.assignedTo = :userId', { userId })
      .andWhere('indicator.status IS NOT NULL')
      .getCount();

    return {
      totalAllocated,
      totalSubmitted: total_submitted,
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
    // Total indicators: where ministry_user = userId
    const total_indicators = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        ministryUser: userId,
      },
    });

    // Total indicator submitted: status is not null and not DRAFT
    const total_indicator_submitted = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.ministryUser = :userId', { userId })
      .andWhere('indicator.status IS NOT NULL')
      .andWhere('indicator.status != :draftStatus', { draftStatus: SubmissionIndicatorStatus.DRAFT })
      .getCount();

    // Total assigned to ministry approver: assigned_to = userId
    const total_assigned_ministry_approver = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        assignedTo: userId,
      },
    });

    // Total indicator nodal ministry: assigned_to != userId and ministry_user = userId (indicators from nodal for this ministry)
    const total_indicator_nodal_ministry = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.ministryUser = :userId', { userId })
      .andWhere('indicator.assignedTo != :userId', { userId })
      .getCount();

    // Total accepted: status is ACCEPTED_BY_MINISTRY or ACCEPTED_BY_MOSPI
    const total_accepted = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        ministryUser: userId,
        status: In([SubmissionIndicatorStatus.ACCEPTED_BY_MINISTRY, SubmissionIndicatorStatus.ACCEPTED_BY_MOSPI]),
      },
    });

    // Total pending submission: status is null or DRAFT
    const total_pending_submission = await this.ministrySubmissionIndicatorRepository
      .createQueryBuilder('indicator')
      .where('indicator.ministryUser = :userId', { userId })
      .andWhere('(indicator.status IS NULL OR indicator.status = :draftStatus)', {
        draftStatus: SubmissionIndicatorStatus.DRAFT,
      })
      .getCount();

    // Total return nodal: status is RETURNED_FROM_MINISTRY
    const total_return_nodal = await this.ministrySubmissionIndicatorRepository.count({
      where: {
        ministryUser: userId,
        status: SubmissionIndicatorStatus.RETURNED_FROM_MINISTRY,
      },
    });

    // Submitted to mospi: submission_form has ministry_user = user id and status is SUBMITTED_TO_MOSPI_REVIEWER or SUBMITTED_TO_MOSPI_APPROVER
    // Then all indicators from submission_indicator which have ministry_user = user id
    const formsSubmittedToMospi = await this.formRepository.find({
      where: {
        ministryUser: userId,
        status: In([FormStatus.SUBMITTED_TO_MOSPI_REVIEWER, FormStatus.SUBMITTED_TO_MOSPI_APPROVER]),
      },
    });

    const formIdsSubmittedToMospi = formsSubmittedToMospi.map((f) => f.id);

    let submittedToMospi = 0;
    if (formIdsSubmittedToMospi.length > 0) {
      // Get submissions with status SUBMITTED_TO_MOSPI_REVIEWER or SUBMITTED_TO_MOSPI_APPROVER for these forms
      const submissionsSubmittedToMospi = await this.ministrySubmissionRepository.find({
        where: {
          formId: In(formIdsSubmittedToMospi),
          status: In([MinistrySubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER, MinistrySubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]),
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

    return {
      totalIndicators: total_indicators,
      totalIndicatorSubmitted: total_indicator_submitted,
      totalAssignedMinistryApprover: total_assigned_ministry_approver,
      totalIndicatorNodalMinistry: total_indicator_nodal_ministry,
      totalAccepted: total_accepted,
      totalPendingSubmission: total_pending_submission,
      totalReturnNodal: total_return_nodal,
      submittedToMospi,
      approvedByMospi,
      returnedFromMospi,
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
        fullSubmission: 0,
        accepted: 0,
        underReview: 0,
        total: 0,
      };
    }

    // Full Submission: total assigned forms (reviewer = userId) and status is not null
    const fullSubmission = forms.filter(
      (form) => form.status !== null,
    ).length;

    // Accepted: status ACCEPTED_BY_MOSPI
    const accepted = forms.filter(
      (form) => form.status === FormStatus.ACCEPTED_BY_MOSPI,
    ).length;

    // Under review: status is null or DRAFT
    const underReview = forms.filter(
      (form) => form.status === null || form.status === FormStatus.DRAFT,
    ).length;

    // Total: count of forms
    const total = forms.length;

    return {
      fullSubmission,
      accepted,
      underReview,
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
      (form) =>  form.status === FormStatus.SUBMITTED_TO_MOSPI_APPROVER,
    ).length;

    // Returned to ministry: status RETURNED_FROM_MOSPI
    const returnedToMinistry = allForms.filter(
      (form) => form.status === FormStatus.RETURNED_FROM_MOSPI,
    ).length;

    // Total: count of all forms
    const total = allForms.length;

    return {
      accepted,
      underReview,
      returnedToMinistry,
      total,
    };
  }

  /**
   * Get progress bar data for ministry user
   * Returns accepted count, total count, and form id
   */
  async getProgressBarData(ministryUserId: string): Promise<{
    status: boolean;
    data: {
      accepted: number;
      total: number;
      formId: string | null;
    };
    message: string;
  }> {
    try {
      // Accepted: status ACCEPTED_BY_MINISTRY where ministry_user = userId
      const accepted = await this.ministrySubmissionIndicatorRepository.count({
        where: {
          ministryUser: ministryUserId,
          status: SubmissionIndicatorStatus.ACCEPTED_BY_MINISTRY,
        },
      });

      // Total: where ministry_user = userId
      const total = await this.ministrySubmissionIndicatorRepository.count({
        where: {
          ministryUser: ministryUserId,
        },
      });

      // Get form id for this ministry user
      const form = await this.formRepository.findOne({
        where: {
          ministryUser: ministryUserId,
        },
        select: ['id'],
      });

      return {
        status: true,
        data: {
          accepted,
          total,
          formId: form?.id || null,
        },
        message: 'Progress bar data retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to retrieve progress bar data',
      );
    }
  }

  /**
   * Get submission details based on user role
   */
  async getSubmissionDetails(userId: string): Promise<{
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
            data: await this.getNodalSubmissionDetails(userId),
            message: 'Nodal submission details retrieved successfully',
          };

        case UserRole.MINISTRY_APPROVER:
          return {
            status: true,
            data: await this.getMinistrySubmissionDetails(userId),
            message: 'Ministry submission details retrieved successfully',
          };

        case UserRole.MOSPI_REVIEWER:
          return {
            status: true,
            data: await this.getMospiReviewerSubmissionDetails(userId),
            message: 'Mospi Reviewer submission details retrieved successfully',
          };

        case UserRole.MOSPI_APPROVER:
          return {
            status: true,
            data: await this.getMospiApproverSubmissionDetails(userId),
            message: 'Mospi Approver submission details retrieved successfully',
          };

        default:
          throw new BadRequestException(
            `Submission details not available for role: ${user.role}`,
          );
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to retrieve submission details',
      );
    }
  }

  /**
   * Helper function to get user details with ministry name mapping
   * Reusable function for all submission detail methods
   */
  private async getUserDetailsWithMinistry(userId: string): Promise<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    ministryId: string;
    ministryName: string | null;
  } | null> {
    // Get user details
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    // Query ministries table to get ministry name
    let ministryName: string | null = null;
    if (user.ministryId) {
      // Query 1: Query ministries table by ID (UUID)
      let ministry = await this.ministryRepository.findOne({
        where: { id: user.ministryId },
      });
      
      // Query 2: If not found by UUID, query ministries table by name
      if (!ministry) {
        ministry = await this.ministryRepository.findOne({
          where: { name: user.ministryId },
        });
      }
      
      // Query 3: If still not found, query all ministries and do case-insensitive match
      if (!ministry) {
        const allMinistries = await this.ministryRepository.find();
        ministry = allMinistries.find(m => 
          m.name.toLowerCase() === user.ministryId.toLowerCase() ||
          m.id.toLowerCase() === user.ministryId.toLowerCase()
        ) || null;
      }
      
      if (ministry) {
        ministryName = ministry.name;
      } else {
        // Fallback: If ministryId looks like a name (not UUID format), use it as the name
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.ministryId);
        if (!isUUID && user.ministryId) {
          // Capitalize first letter of each word
          ministryName = user.ministryId
            .split(/[\s._-]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      ministryId: user.ministryId,
      ministryName: ministryName,
    };
  }

  /**
   * Get submission details for Nodal user
   * Find submission by user id and return its data with user details
   */
  private async getNodalSubmissionDetails(userId: string): Promise<any> {
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { userId: userId },
      order: { createdAt: 'DESC' },
    });

    if (!submission) {
      return {
        submission: null,
        message: 'No submission found for this user',
        user: null,
      };
    }

    // Get user details using helper function
    const user = await this.getUserDetailsWithMinistry(userId);

    return {
      submission: {
        id: submission.id,
        submissionId: submission.submissionId,
        userId: submission.userId,
        formId: submission.formId,
        status: submission.status,
        isConsolidated: submission.isConsolidated,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      },
      submissionId: submission.submissionId, // SUB- format
      user: user,
    };
  }

  /**
   * Get submission details for Ministry Approver
   * Find form by ministry user, then get all submissions for that form
   */
  private async getMinistrySubmissionDetails(userId: string): Promise<any> {
    // Find forms associated with ministry user
    const forms = await this.formRepository.find({
      where: {
        ministryUser: userId,
        
      },
    });

    if (forms.length === 0) {
      return {
        forms: [],
        submissions: [],
        message: 'No forms found for this ministry user',
      };
    }

    const formIds = forms.map((f) => f.id);

    // Get all submissions for these forms
    const allSubmissions = await this.ministrySubmissionRepository.find({
      where: {
        formId: In(formIds),
      },
      order: { createdAt: 'DESC' },
    });

    // Filter out submissions with null or DRAFT status
    const submissions = allSubmissions.filter(
      (submission) => submission.status !== null && submission.status !== MinistrySubmissionStatus.DRAFT
    );

    // Get unique user IDs from submissions
    const userIds = [...new Set(submissions.map((s) => s.userId))];
    
    // Get user details for all users
    const userDetailsMap = new Map<string, any>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userDetails = await this.getUserDetailsWithMinistry(uid);
        if (userDetails) {
          userDetailsMap.set(uid, userDetails);
        }
      })
    );

    // Map submissions with user details
    const submissionsWithUserDetails = submissions.map((submission) => ({
      id: submission.id,
      submissionId: submission.submissionId,
      userId: submission.userId,
      formId: submission.formId,
      status: submission.status,
      isConsolidated: submission.isConsolidated,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      user: userDetailsMap.get(submission.userId) || null,
    }));

    return {
      forms: forms,
      submissions: submissionsWithUserDetails,
    };
  }

  /**
   * Helper function to get form status label based on form status and user role
   */
  private getFormStatusLabel(formStatus: FormStatus | null, userRole: UserRole): string | null {
    if (!formStatus) {
      return null;
    }

    if (formStatus === FormStatus.ACCEPTED_BY_MOSPI) {
      return 'ACCEPTED';
    }

    if (formStatus === FormStatus.RETURNED_FROM_MOSPI) {
      // Only show "Returned to Ministry" for MOSPI_APPROVER
      if (userRole === UserRole.MOSPI_APPROVER) {
        return 'Returned to Ministry';
      }
      return null;
    }

    // UNDER REVIEW statuses
    if (userRole === UserRole.MOSPI_REVIEWER) {
      if (formStatus === FormStatus.SUBMITTED_TO_MOSPI_REVIEWER) {
        return 'UNDER REVIEW';
      }
    }

    if (userRole === UserRole.MOSPI_APPROVER) {
      if (formStatus === FormStatus.SUBMITTED_TO_MOSPI_APPROVER || 
          formStatus === FormStatus.SUBMITTED_TO_MOSPI_REVIEWER) {
        return 'UNDER REVIEW';
      }
    }

    return null;
  }

  /**
   * Get submission details for Mospi Reviewer
   * Get associated form, then get submissions where isConsolidated is true
   */
  private async getMospiReviewerSubmissionDetails(userId: string): Promise<any> {
    // Get forms where reviewer = userId
    const forms = await this.formRepository.find({
      where: {
        reviewer: userId,
      },
    });

    if (forms.length === 0) {
      return {
        forms: [],
        submissions: [],
        message: 'No forms found for this reviewer',
      };
    }

    const formIds = forms.map((f) => f.id);

    // Get submissions for these forms where isConsolidated is true
    const submissions = await this.ministrySubmissionRepository.find({
      where: {
        formId: In(formIds),
        isConsolidated: true,
      },
      order: { createdAt: 'DESC' },
    });

    // Get unique user IDs from submissions
    const userIds = [...new Set(submissions.map((s) => s.userId))];
    
    // Get user details for all users
    const userDetailsMap = new Map<string, any>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userDetails = await this.getUserDetailsWithMinistry(uid);
        if (userDetails) {
          userDetailsMap.set(uid, userDetails);
        }
      })
    );

    // Create form map with status labels
    const formMap = new Map<string, Form>();
    forms.forEach((form) => {
      formMap.set(form.id, form);
    });

    // Map submissions with user details and form status
    const submissionsWithUserDetails = submissions.map((submission) => {
      const form = formMap.get(submission.formId);
      const formStatusLabel = this.getFormStatusLabel(form?.status || null, UserRole.MOSPI_REVIEWER);

      return {
        id: submission.id,
        submissionId: submission.submissionId,
        userId: submission.userId,
        formId: submission.formId,
        status: submission.status,
        isConsolidated: submission.isConsolidated,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        user: userDetailsMap.get(submission.userId) || null,
        formStatus: form?.status || null,
        formStatusLabel: formStatusLabel,
      };
    });

    // Map forms with status labels
    const formsWithStatus = forms.map((form) => ({
      id: form.id,
      year: form.year,
      ministry: form.ministry,
      reviewer: form.reviewer,
      ministryUser: form.ministryUser,
      status: form.status,
      formStatusLabel: this.getFormStatusLabel(form.status, UserRole.MOSPI_REVIEWER),
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    }));

    return {
      forms: formsWithStatus,
      submissions: submissionsWithUserDetails,
    };
  }

  /**
   * Get submission details for Mospi Approver
   * First get all forms with specified statuses, then get consolidated submissions for those forms
   */
  private async getMospiApproverSubmissionDetails(userId: string): Promise<any> {
    // Step 1: Get all forms with status matching the specified conditions
    const forms = await this.formRepository.find({
      where: {
        status: In([FormStatus.SUBMITTED_TO_MOSPI_APPROVER, FormStatus.ACCEPTED_BY_MOSPI, FormStatus.RETURNED_FROM_MOSPI])
      },
    });

    if (forms.length === 0) {
      return {
        submissions: [],
        message: 'No forms found with the specified statuses',
      };
    }

    // Step 2: Get form IDs from the forms
    const formIds = forms.map((form) => form.id);

    // Step 3: Get all submissions where isConsolidated is true for these form IDs
    const submissions = await this.ministrySubmissionRepository.find({
      where: {
        formId: In(formIds),
        isConsolidated: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (submissions.length === 0) {
      return {
        submissions: [],
        message: 'No consolidated submissions found for the specified forms',
      };
    }

    // Get unique user IDs from submissions
    const userIds = [...new Set(submissions.map((s) => s.userId))];
    
    // Get user details for all users
    const userDetailsMap = new Map<string, any>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userDetails = await this.getUserDetailsWithMinistry(uid);
        if (userDetails) {
          userDetailsMap.set(uid, userDetails);
        }
      })
    );

    // Create form map for status labels
    const formMap = new Map<string, Form>();
    forms.forEach((form) => {
      formMap.set(form.id, form);
    });

    // Map submissions with user details and form status (include formId but not form data)
    const submissionsWithUserDetails = submissions.map((submission) => {
      const form = formMap.get(submission.formId);
      const formStatusLabel = this.getFormStatusLabel(form?.status || null, UserRole.MOSPI_APPROVER);

      return {
        id: submission.id,
        submissionId: submission.submissionId,
        userId: submission.userId,
        formId: submission.formId, // Include formId in response
        status: submission.status,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        user: userDetailsMap.get(submission.userId) || null,
        formStatus: form?.status || null,
        formStatusLabel: formStatusLabel,
      };
    });

    return {
      submissions: submissionsWithUserDetails,
    };
  }
}

