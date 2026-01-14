import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MinistrySubmissionIndicator, SubmissionIndicatorStatus } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField, DataType } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';
import { Form, FormStatus } from '../entities/form.entity';
import { MinistrySubmissionStatus } from '../entities/ministry-submission.entity';
import { MinistrySubmissionComment } from '../entities/ministry-submission-comment.entity';
import { User } from '../../entities/user.entity';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';
import { UpdateSubmissionIndicatorStatusDto } from './dto/update-submission-indicator-status.dto';
import { UpdateFormStatusDto } from './dto/update-form-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class MinistryFormSubmissionService {
  constructor(
    @InjectRepository(MinistrySubmissionIndicator)
    private readonly ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
    @InjectRepository(MinistrySubmission)
    private readonly ministrySubmissionRepository: Repository<MinistrySubmission>,
    @InjectRepository(IndicatorDetail)
    private readonly indicatorDetailRepository: Repository<IndicatorDetail>,
    @InjectRepository(IndicatorSubsection)
    private readonly indicatorSubsectionRepository: Repository<IndicatorSubsection>,
    @InjectRepository(InputField)
    private readonly inputFieldRepository: Repository<InputField>,
    @InjectRepository(MinistrySubmissionData)
    private readonly ministrySubmissionDataRepository: Repository<MinistrySubmissionData>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(MinistrySubmissionComment)
    private readonly ministrySubmissionCommentRepository: Repository<MinistrySubmissionComment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Submit ministry form data
   * Saves input values and subsection values based on their data types
   */
  async submitMinistryData(dto: SubmitMinistryDataDto): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Step 1: Get submission indicator details
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: dto.submissionIndicatorId },
      });

      if (!submissionIndicator) {
        throw new NotFoundException(
          `Submission indicator with id ${dto.submissionIndicatorId} not found`,
        );
      }

      const { submissionId, indicatorId } = submissionIndicator;

      // Step 2: Get indicator details and all its input fields
      const indicator = await this.indicatorDetailRepository.findOne({
        where: { id: indicatorId },
      });

      if (!indicator) {
        throw new NotFoundException(`Indicator with id ${indicatorId} not found`);
      }

      // Get all input fields for the indicator
      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: indicatorId },
      });

      // Step 3: Get subindicators (subsections) related to the indicator
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: indicatorId, status: true },
        order: { sequence: 'ASC' },
      });

      // Get input fields for each subsection
      const subsectionInputFieldsMap = new Map<string, InputField[]>();
      for (const subsection of subsections) {
        const inputFields = await this.inputFieldRepository.find({
          where: { sectionId: subsection.id },
        });
        subsectionInputFieldsMap.set(subsection.id, inputFields);
      }

      // Step 4: Process and save inputs data
      const savedData: MinistrySubmissionData[] = [];

      // Process inputs array
      for (const input of dto.data.inputs) {
        const inputField = indicatorInputFields.find((field) => field.id === input.inputId);
        
        if (!inputField) {
          throw new NotFoundException(
            `Input field with id ${input.inputId} not found for indicator ${indicatorId}`,
          );
        }

        const submissionData = this.createSubmissionData(
          dto.submissionIndicatorId,
          input.inputId,
          inputField.dataType,
          input.value,
        );

        savedData.push(submissionData);
      }

      // Step 5: Process subsection data (array inside array)
      // subsection is an array of arrays: [[{inputId, value}, ...], [{inputId, value}, ...]]
      // Each array represents a row, assign sequence: first array = 1, second = 2, etc.
      dto.data.subsection.forEach((subsectionArray, arrayIndex) => {
        const sequence = arrayIndex + 1; // Sequence starts from 1
        
        for (const subsectionInput of subsectionArray) {
          // Find which subsection this input belongs to
          let foundSubsection: IndicatorSubsection | null = null;
          let foundInputField: InputField | null = null;

          for (const subsection of subsections) {
            const subsectionInputFields = subsectionInputFieldsMap.get(subsection.id) || [];
            const inputField = subsectionInputFields.find(
              (field) => field.id === subsectionInput.inputId,
            );

            if (inputField) {
              foundSubsection = subsection;
              foundInputField = inputField;
              break;
            }
          }

          if (!foundInputField) {
            throw new NotFoundException(
              `Input field with id ${subsectionInput.inputId} not found in any subsection`,
            );
          }

          const submissionData = this.createSubmissionData(
            dto.submissionIndicatorId,
            subsectionInput.inputId,
            foundInputField.dataType,
            subsectionInput.value,
            sequence, // Assign sequence number for this row
          );

          savedData.push(submissionData);
        }
      });

      // Step 6: Save all data to database
      const saved = await this.ministrySubmissionDataRepository.save(savedData);

      // Step 7: Update submission indicator status (use status from DTO or default to DRAFT)
      const statusToUpdate = dto.status || SubmissionIndicatorStatus.DRAFT;
      await this.ministrySubmissionIndicatorRepository.update(
        { id: dto.submissionIndicatorId },
        { status: statusToUpdate }
      );

      // If status is SUBMITTED_TO_MINISTRY, also update the MinistrySubmission status to SUBMITTED_TO_MINISTRY
      if (statusToUpdate === SubmissionIndicatorStatus.SUBMITTED_TO_MINISTRY) {
        // First, find the submission indicator to get the submissionId
          await this.ministrySubmissionRepository.update(
            { id: submissionIndicator.submissionId },
            { status: MinistrySubmissionStatus.SUBMITTED_TO_MINISTRY }
          );
      }

      return {
        status: true,
        message: 'Ministry submission data saved successfully',
        data: {
          submissionIndicatorId: dto.submissionIndicatorId,
          submissionId,
          indicatorId,
          savedCount: saved.length,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to save ministry submission data: ${error.message}`,
      );
    }
  }

  /**
   * Create MinistrySubmissionData entity based on data type
   */
  private createSubmissionData(
    submissionIndicatorId: string,
    inputFieldId: string,
    dataType: DataType,
    value: any,
    sequence?: number | null,
  ): MinistrySubmissionData {
    const submissionData = new MinistrySubmissionData();
    submissionData.submissionIndicatorId = submissionIndicatorId;
    submissionData.inputFieldId = inputFieldId;
    submissionData.sequence = sequence ?? null;
    
    // Set value based on data type
    switch (dataType) {
      case DataType.NUMBER:
        submissionData.valueNumber = value != null ? Number(value) : null;
        break;

      case DataType.FILE:
        // For file input, save in value_json
        if (value != null) {
          if (typeof value === 'string') {
            try {
              submissionData.valueJson = JSON.parse(value);
            } catch (e) {
              // If parsing fails, store as string in JSON format
              submissionData.valueJson = value;
            }
          } else {
            submissionData.valueJson = value;
          }
        } else {
          submissionData.valueJson = null;
        }
        break;

      case DataType.STRING:
      default:
        // Check if it's a date string
        if (value && typeof value === 'string') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}/;
          if (dateRegex.test(value)) {
            submissionData.valueDate = new Date(value);
          } else {
            submissionData.valueText = value;
          }
        } else {
          submissionData.valueText = value != null ? String(value) : null;
        }
        break;
    }

    return submissionData;
  }

  /**
   * Update or create MinistrySubmissionData entity based on data type
   * Updates existing record if found, otherwise creates new one
   */
  private async updateOrCreateSubmissionData(
    submissionIndicatorId: string,
    inputFieldId: string,
    dataType: DataType,
    value: any,
    sequence?: number | null,
  ): Promise<MinistrySubmissionData> {
    // Try to find existing record - match by submissionIndicatorId, inputFieldId, and sequence (if provided)
    const whereCondition: any = {
      submissionIndicatorId: submissionIndicatorId,
      inputFieldId: inputFieldId,
    };
    
    // If sequence is provided, also match by sequence to find the correct row
    if (sequence != null) {
      whereCondition.sequence = sequence;
    }
    
    const existingData = await this.ministrySubmissionDataRepository.findOne({
      where: whereCondition,
    });

    let submissionData: MinistrySubmissionData;
    
    if (existingData) {
      // Update existing record
      submissionData = existingData;
    } else {
      // Create new record
      submissionData = new MinistrySubmissionData();
      submissionData.submissionIndicatorId = submissionIndicatorId;
      submissionData.inputFieldId = inputFieldId;
    }
    
    // Set sequence (always update sequence even for existing records)
    submissionData.sequence = sequence ?? null;
    
    // Set value based on data type
    switch (dataType) {
      case DataType.NUMBER:
        submissionData.valueNumber = value != null ? Number(value) : null;
        submissionData.valueText = null;
        submissionData.valueDate = null;
        submissionData.valueJson = null;
        break;

      case DataType.FILE:
        // For file input, save in value_json
        if (value != null) {
          if (typeof value === 'string') {
            try {
              submissionData.valueJson = JSON.parse(value);
            } catch (e) {
              // If parsing fails, store as string in JSON format
              submissionData.valueJson = value;
            }
          } else {
            submissionData.valueJson = value;
          }
        } else {
          submissionData.valueJson = null;
        }
        submissionData.valueText = null;
        submissionData.valueNumber = null;
        submissionData.valueDate = null;
        break;

      case DataType.STRING:
      default:
        // Check if it's a date string
        if (value && typeof value === 'string') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}/;
          if (dateRegex.test(value)) {
            submissionData.valueDate = new Date(value);
            submissionData.valueText = null;
          } else {
            submissionData.valueText = value;
            submissionData.valueDate = null;
          }
        } else {
          submissionData.valueText = value != null ? String(value) : null;
          submissionData.valueDate = null;
        }
        submissionData.valueNumber = null;
        submissionData.valueJson = null;
        break;
    }

    return submissionData;
  }

  /**
   * Update ministry form data
   * Updates existing submission data or creates new if not exists
   * Uses the same process as submitMinistryData but updates instead of creates
   */
  async updateMinistryData(dto: SubmitMinistryDataDto): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Step 1: Get submission indicator details
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: dto.submissionIndicatorId },
      });

      if (!submissionIndicator) {
        throw new NotFoundException(
          `Submission indicator with id ${dto.submissionIndicatorId} not found`,
        );
      }

      const { submissionId, indicatorId } = submissionIndicator;

      // Step 2: Get indicator details and all its input fields
      const indicator = await this.indicatorDetailRepository.findOne({
        where: { id: indicatorId },
      });

      if (!indicator) {
        throw new NotFoundException(`Indicator with id ${indicatorId} not found`);
      }

      // Get all input fields for the indicator
      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: indicatorId },
      });

      // Step 3: Get subindicators (subsections) related to the indicator
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: indicatorId, status: true },
        order: { sequence: 'ASC' },
      });

      // Get input fields for each subsection
      const subsectionInputFieldsMap = new Map<string, InputField[]>();
      for (const subsection of subsections) {
        const inputFields = await this.inputFieldRepository.find({
          where: { sectionId: subsection.id },
        });
        subsectionInputFieldsMap.set(subsection.id, inputFields);
      }

      // Step 4: Process and update/create inputs data
      const dataToSave: MinistrySubmissionData[] = [];

      // Process inputs array
      for (const input of dto.data.inputs) {
        const inputField = indicatorInputFields.find((field) => field.id === input.inputId);
        
        if (!inputField) {
          throw new NotFoundException(
            `Input field with id ${input.inputId} not found for indicator ${indicatorId}`,
          );
        }

        const submissionData = await this.updateOrCreateSubmissionData(
          dto.submissionIndicatorId,
          input.inputId,
          inputField.dataType,
          input.value,
        );

        dataToSave.push(submissionData);
      }

      // Step 5: Process subsection data (array inside array)
      // subsection is an array of arrays: [[{inputId, value}, ...], [{inputId, value}, ...]]
      // Each array represents a row, assign sequence: first array = 1, second = 2, etc.
      for (let arrayIndex = 0; arrayIndex < dto.data.subsection.length; arrayIndex++) {
        const subsectionArray = dto.data.subsection[arrayIndex];
        const sequence = arrayIndex + 1; // Sequence starts from 1
        
        for (const subsectionInput of subsectionArray) {
          // Find which subsection this input belongs to
          let foundSubsection: IndicatorSubsection | null = null;
          let foundInputField: InputField | null = null;

          for (const subsection of subsections) {
            const subsectionInputFields = subsectionInputFieldsMap.get(subsection.id) || [];
            const inputField = subsectionInputFields.find(
              (field) => field.id === subsectionInput.inputId,
            );

            if (inputField) {
              foundSubsection = subsection;
              foundInputField = inputField;
              break;
            }
          }

          if (!foundInputField) {
            throw new NotFoundException(
              `Input field with id ${subsectionInput.inputId} not found in any subsection`,
            );
          }

          const submissionData = await this.updateOrCreateSubmissionData(
            dto.submissionIndicatorId,
            subsectionInput.inputId,
            foundInputField.dataType,
            subsectionInput.value,
            sequence, // Assign sequence number for this row
          );

          dataToSave.push(submissionData);
        }
      }

      // Step 6: Save all data to database (updates existing, creates new)
      const saved = await this.ministrySubmissionDataRepository.save(dataToSave);

      // Step 7: Update submission indicator status (use status from DTO or default to DRAFT)
      const statusToUpdate = dto.status || SubmissionIndicatorStatus.DRAFT;
      await this.ministrySubmissionIndicatorRepository.update(
        { id: dto.submissionIndicatorId },
        { status: statusToUpdate }
      );

      return {
        status: true,
        message: 'Ministry submission data updated successfully',
        data: {
          submissionIndicatorId: dto.submissionIndicatorId,
          submissionId,
          indicatorId,
          updatedCount: saved.length,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update ministry submission data: ${error.message}`,
      );
    }
  }

  /**
   * Update submission indicator status
   */
  async updateSubmissionIndicatorStatus(
    dto: UpdateSubmissionIndicatorStatusDto,
  ): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Check if submission indicator exists
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: dto.submissionIndicatorId },
      });

      if (!submissionIndicator) {
        throw new NotFoundException(
          `Submission indicator with id ${dto.submissionIndicatorId} not found`,
        );
      }

      // Update the status
      await this.ministrySubmissionIndicatorRepository.update(
        { id: dto.submissionIndicatorId },
        { status: dto.status },
      );

      // Task 1: If status is RETURNED_FROM_MINISTRY or RETURNED_FROM_MOSPI, mark submission as SUBMITTED_TO_MINISTRY
      if (dto.status === SubmissionIndicatorStatus.RETURNED_FROM_MINISTRY || 
          dto.status === SubmissionIndicatorStatus.RETURNED_FROM_MOSPI) {
        await this.ministrySubmissionRepository.update(
          { id: submissionIndicator.submissionId },
          { status: MinistrySubmissionStatus.SUBMITTED_TO_MINISTRY },
        );
      }

      // Task 2: If status is ACCEPTED_BY_MINISTRY or ACCEPTED_BY_MOSPI, use handleSubmissionOnIndicatorUpdates
      if (dto.status === SubmissionIndicatorStatus.ACCEPTED_BY_MINISTRY || 
          dto.status === SubmissionIndicatorStatus.ACCEPTED_BY_MOSPI) {
        await this.handleSubmissionOnIndicatorUpdates(dto.submissionIndicatorId);
      }

      return {
        status: true,
        message: 'Submission indicator status updated successfully',
        data: {
          submissionIndicatorId: dto.submissionIndicatorId,
          newStatus: dto.status,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update submission indicator status: ${error.message}`,
      );
    }
  }

  /**
   * Handle submission status update based on all indicator statuses
   * If all indicators are ACCEPTED_BY_MINISTRY or ACCEPTED_BY_MOSPI, set submission to APPROVED
   * Otherwise, set submission to SUBMITTED_TO_MINISTRY
   */
  private async handleSubmissionOnIndicatorUpdates(submissionIndicatorId: string): Promise<void> {
    try {
      // Step 1: Get the submission indicator to get the submission ID
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: submissionIndicatorId },
      });

      if (!submissionIndicator) {
        return; // If indicator not found, silently return
      }

      const submissionId = submissionIndicator.submissionId;

      // Step 2: Get all indicators for this submission
      const allIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: { submissionId: submissionId },
      });

      if (allIndicators.length === 0) {
        return; // No indicators found, nothing to update
      }

      // Step 3: Check if all indicators have status ACCEPTED_BY_MINISTRY or ACCEPTED_BY_MOSPI
      const allAccepted = allIndicators.every((indicator) => {
        return indicator.status === SubmissionIndicatorStatus.ACCEPTED_BY_MINISTRY ||
               indicator.status === SubmissionIndicatorStatus.ACCEPTED_BY_MOSPI;
      });

      // Step 4: Update submission status
      let newSubmissionStatus: MinistrySubmissionStatus;
      if (allAccepted) {
        newSubmissionStatus = MinistrySubmissionStatus.APPROVED;
      } else {
        newSubmissionStatus = MinistrySubmissionStatus.SUBMITTED_TO_MINISTRY;
      }

      // Update the submission status
      await this.ministrySubmissionRepository.update(
        { id: submissionId },
        { status: newSubmissionStatus },
      );
    } catch (error) {
      // Log error but don't throw - this is a side effect, shouldn't break the main flow
      console.error('Error in handleSubmissionOnIndicatorUpdates:', error);
    }
  }

  /**
   * Update form status based on user role
   */
  async updateFormStatus(
    dto: UpdateFormStatusDto,
    userId: string,
    userRole: string,
  ): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      let form: Form | null = null;
      let formId: string;

      // Role-based form finding logic
      if (userRole === 'MINISTRY_APPROVER') {
        // For Ministry Approver: Find form associated with user (ministry_user = userId)
        if (dto.formId) {
          form = await this.formRepository.findOne({
            where: {
              id: dto.formId,
              ministryUser: userId,
            },
          });
        } else {
          // If formId not provided, find any form for this ministry user
          form = await this.formRepository.findOne({
            where: {
              ministryUser: userId,
            },
          });
        }

        if (!form) {
          throw new NotFoundException(
            `Form not found for ministry user ${userId}`,
          );
        }
        formId = form.id;
      } else if (userRole === 'MOSPI_REVIEWER') {
        // For Mospi Reviewer: Find form with reviewer = userId
        if (dto.formId) {
          form = await this.formRepository.findOne({
            where: {
              id: dto.formId,
              reviewer: userId,
            },
          });
        } else {
          // If formId not provided, find any form for this reviewer
          form = await this.formRepository.findOne({
            where: {
              reviewer: userId,
            },
          });
        }

        if (!form) {
          throw new NotFoundException(
            `Form not found for reviewer ${userId}`,
          );
        }
        formId = form.id;
      } else if (userRole === 'MOSPI_APPROVER') {
        // For Mospi Approver: Update status based on formId
        if (!dto.formId) {
          throw new BadRequestException('Form ID is required for MOSPI_APPROVER');
        }

        form = await this.formRepository.findOne({
          where: { id: dto.formId },
        });

        if (!form) {
          throw new NotFoundException(`Form with id ${dto.formId} not found`);
        }
        formId = dto.formId;
      } else {
        throw new BadRequestException(
          `Form status update not allowed for role: ${userRole}`,
        );
      }

      // Update the status
      await this.formRepository.update(
        { id: formId },
        { status: dto.status },
      );

      // If user is MINISTRY_APPROVER, create a ministry submission with isConsolidated = true
      let createdSubmission = null;
      if (userRole === 'MINISTRY_APPROVER' && form) {
        // Generate submissionId: SUB-{year}-{randomNum}
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 1000000)
          .toString()
          .padStart(6, '0');
        const submissionId = `SUB-${year}-${randomNum}`;

        // Create ministry submission
        const newSubmission = this.ministrySubmissionRepository.create({
          submissionId: submissionId,
          formId: formId,
          userId: form.ministryUser, // Use form's ministry user id
          status: MinistrySubmissionStatus.DRAFT,
          isConsolidated: true,
        });

        createdSubmission = await this.ministrySubmissionRepository.save(newSubmission);
      }

      return {
        status: true,
        message: 'Form status updated successfully',
        data: {
          formId: formId,
          newStatus: dto.status,
          submission: createdSubmission,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update form status: ${error.message}`,
      );
    }
  }

  /**
   * Create a comment for a submission indicator
   */
  async createComment(
    dto: CreateCommentDto,
    userId: string,
  ): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Step 1: Verify that the submission indicator exists
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: dto.submissionIndicatorId },
      });

      if (!submissionIndicator) {
        throw new NotFoundException(
          `Submission indicator with id ${dto.submissionIndicatorId} not found`,
        );
      }

      // Step 2: Create the comment
      const comment = this.ministrySubmissionCommentRepository.create({
        submissionIndicatorId: dto.submissionIndicatorId,
        userId: userId,
        text: dto.text,
      });

      // Step 3: Save the comment
      const savedComment = await this.ministrySubmissionCommentRepository.save(comment);

      return {
        status: true,
        message: 'Comment created successfully',
        data: {
          id: savedComment.id,
          submissionIndicatorId: savedComment.submissionIndicatorId,
          userId: savedComment.userId,
          text: savedComment.text,
          createdAt: savedComment.createdAt,
          updatedAt: savedComment.updatedAt,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create comment: ${error.message}`,
      );
    }
  }

  /**
   * Get all comments for a submission indicator, sorted by createdAt
   */
  async getCommentsBySubmissionIndicator(submissionIndicatorId: string): Promise<{
    status: boolean;
    message: string;
    data: any[];
  }> {
    try {
      // Step 1: Verify that the submission indicator exists
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: submissionIndicatorId },
      });

      if (!submissionIndicator) {
        throw new NotFoundException(
          `Submission indicator with id ${submissionIndicatorId} not found`,
        );
      }

      // Step 2: Get all comments for this submission indicator, sorted by createdAt (ascending - oldest first)
      const comments = await this.ministrySubmissionCommentRepository.find({
        where: { submissionIndicatorId: submissionIndicatorId },
        order: { createdAt: 'ASC' },
      });

      // Step 3: Get unique user IDs from comments
      const userIds = [...new Set(comments.map((comment) => comment.userId))];

      // Step 4: Fetch user details for all users
      const users = userIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(userIds) },
            select: ['id', 'firstName', 'lastName', 'email', 'role', 'ministryId'],
          })
        : [];

      // Step 5: Create a map of userId -> user details
      const userMap = new Map<string, User>();
      users.forEach((user) => {
        userMap.set(user.id, user);
      });

      // Step 6: Format the response with user details
      const formattedComments = comments.map((comment) => ({
        id: comment.id,
        submissionIndicatorId: comment.submissionIndicatorId,
        userId: comment.userId,
        text: comment.text,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: userMap.get(comment.userId) ? {
          id: userMap.get(comment.userId)!.id,
          firstName: userMap.get(comment.userId)!.firstName,
          lastName: userMap.get(comment.userId)!.lastName,
          email: userMap.get(comment.userId)!.email,
          role: userMap.get(comment.userId)!.role,
          ministryId: userMap.get(comment.userId)!.ministryId,
        } : null,
      }));

      return {
        status: true,
        message: `Retrieved ${formattedComments.length} comment(s) for submission indicator`,
        data: formattedComments,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to retrieve comments: ${error.message}`,
      );
    }
  }
}
