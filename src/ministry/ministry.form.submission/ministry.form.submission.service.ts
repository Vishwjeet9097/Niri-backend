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
import { DeleteSubmissionDataDto } from './dto/delete-submission-data.dto';
import { MospiFormActionDto } from './dto/mospi-form-action.dto';
import { DeleteFileDataDto, DeleteFileAction } from './dto/delete-file-data.dto';

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

      case DataType.DATE:
        // For date input, save in valueDate
        if (value != null) {
          if (value instanceof Date) {
            submissionData.valueDate = value;
          } else if (typeof value === 'string') {
            submissionData.valueDate = new Date(value);
          } else {
            submissionData.valueDate = null;
          }
        } else {
          submissionData.valueDate = null;
        }
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
        submissionData.valueText = value != null ? String(value) : null;
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

      case DataType.DATE:
        // For date input, save in valueDate
        if (value != null) {
          if (value instanceof Date) {
            submissionData.valueDate = value;
          } else if (typeof value === 'string') {
            submissionData.valueDate = new Date(value);
          } else {
            submissionData.valueDate = null;
          }
        } else {
          submissionData.valueDate = null;
        }
        submissionData.valueText = null;
        submissionData.valueNumber = null;
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
        submissionData.valueText = value != null ? String(value) : null;
        submissionData.valueNumber = null;
        submissionData.valueDate = null;
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
          status: MinistrySubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
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

  /**
   * Delete submission data rows by primaryId array
   * For each primaryId, validates that all rows with the same sequence belong to the same submission indicator
   * Then deletes all rows with that submissionIndicatorId and sequence
   */
  async deleteSubmissionData(
    dto: DeleteSubmissionDataDto,
  ): Promise<{
    status: boolean;
    message: string;
    deletedCount?: number;
  }> {
    try {
      const { submissionIndicatorId, inputPrimaryId } = dto;
      let totalDeletedCount = 0;
      const errors: string[] = [];

      // Process each primaryId
      for (const primaryId of inputPrimaryId) {
        try {
          // Step 1: Find the row with the provided primaryId
          const primaryRow = await this.ministrySubmissionDataRepository.findOne({
            where: { id: primaryId },
          });

          if (!primaryRow) {
            errors.push(`Submission data with primaryId ${primaryId} not found`);
            continue;
          }

          // Step 2: Validate that the primary row belongs to the provided submissionIndicatorId
          if (primaryRow.submissionIndicatorId !== submissionIndicatorId) {
            errors.push(
              `Primary row with id ${primaryId} does not belong to submission indicator ${submissionIndicatorId}`,
            );
            continue;
          }

          // Step 3: Get the sequence number from the primary row
          const sequence = primaryRow.sequence;

          // Step 4: Find all rows with the same submissionIndicatorId and sequence
          const rowsToDelete = await this.ministrySubmissionDataRepository.find({
            where: {
              submissionIndicatorId: submissionIndicatorId,
              sequence: sequence,
            },
          });

          if (rowsToDelete.length === 0) {
            continue; // No rows to delete for this primaryId
          }

          // Step 5: Validate that all rows belong to the same submission indicator
          const allBelongToSameIndicator = rowsToDelete.every(
            (row) => row.submissionIndicatorId === submissionIndicatorId,
          );

          if (!allBelongToSameIndicator) {
            errors.push(
              `Not all rows belong to the same submission indicator for primaryId ${primaryId}`,
            );
            continue;
          }

          // Step 6: Validate that all rows have the same sequence number
          const allHaveSameSequence = rowsToDelete.every(
            (row) => row.sequence === sequence,
          );

          if (!allHaveSameSequence) {
            errors.push(
              `Not all rows have the same sequence number for primaryId ${primaryId}`,
            );
            continue;
          }

          // Step 7: Delete all rows
          const deleteResult = await this.ministrySubmissionDataRepository.delete({
            submissionIndicatorId: submissionIndicatorId,
            sequence: sequence,
          });

          totalDeletedCount += deleteResult.affected || 0;
        } catch (error) {
          errors.push(`Error processing primaryId ${primaryId}: ${error.message}`);
        }
      }

      // If there were errors but some deletions succeeded, return partial success
      if (errors.length > 0 && totalDeletedCount > 0) {
        return {
          status: true,
          message: `Successfully deleted ${totalDeletedCount} row(s), but encountered ${errors.length} error(s)`,
          deletedCount: totalDeletedCount,
        };
      }

      // If there were errors and no deletions, throw an error
      if (errors.length > 0) {
        throw new BadRequestException(
          `Failed to delete submission data: ${errors.join('; ')}`,
        );
      }

      return {
        status: true,
        message: `Successfully deleted ${totalDeletedCount} row(s)`,
        deletedCount: totalDeletedCount,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to delete submission data',
      );
    }
  }

  /**
   * MOSPI Approver: Send back form
   * 1. Update form status to RETURNED_FROM_MOSPI
   * 2. Find consolidated submission and update status to RETURNED_FROM_MOSPI_APPROVER
   * 3. For all submissions of that form, find indicators with RETURNED_FROM_MOSPI_APPROVER_DRAFT and update to RETURNED_FROM_MOSPI_APPROVER
   */
  async mospiApproverSendBack(
    dto: MospiFormActionDto,
    userId: string,
  ): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Find form - MOSPI Approver can access any form, but if formId is provided, use it
      let form: Form | null = null;
      let formId: string;

      if (dto.formId) {
        form = await this.formRepository.findOne({
          where: { id: dto.formId },
        });
        if (!form) {
          throw new NotFoundException(`Form with id ${dto.formId} not found`);
        }
        formId = dto.formId;
      } else {
        // If formId not provided, find a form that needs MOSPI Approver action
        // Find forms with status SUBMITTED_TO_MOSPI_APPROVER
        form = await this.formRepository.findOne({
          where: { status: FormStatus.SUBMITTED_TO_MOSPI_APPROVER },
          order: { updatedAt: 'DESC' },
        });
        if (!form) {
          throw new NotFoundException('No form found for MOSPI Approver action');
        }
        formId = form.id;
      }

      // Step 1: Update form status to RETURNED_FROM_MOSPI
      await this.formRepository.update(
        { id: formId },
        { status: FormStatus.RETURNED_FROM_MOSPI },
      );

      // Step 2: Find consolidated submission for this form
      const consolidatedSubmission = await this.ministrySubmissionRepository.findOne({
        where: {
          formId: formId,
          isConsolidated: true,
        },
      });

      if (consolidatedSubmission) {
        // Update consolidated submission status to RETURNED_FROM_MOSPI_APPROVER
        await this.ministrySubmissionRepository.update(
          { id: consolidatedSubmission.id },
          { status: MinistrySubmissionStatus.RETURNED_FROM_MOSPI_APPROVER },
        );
      }

      // Step 3: Get all submissions for this form
      const allSubmissions = await this.ministrySubmissionRepository.find({
        where: { formId: formId },
      });

      const submissionIds = allSubmissions.map((s) => s.id);
      let indicatorsUpdatedCount = 0;

      if (submissionIds.length > 0) {
        // Find all indicators with RETURNED_FROM_MOSPI_APPROVER_DRAFT status
        const indicatorsToUpdate = await this.ministrySubmissionIndicatorRepository.find({
          where: {
            submissionId: In(submissionIds),
            status: SubmissionIndicatorStatus.RETURNED_FROM_MOSPI_APPROVER_DRAFT,
          },
        });

        indicatorsUpdatedCount = indicatorsToUpdate.length;

        // Update all indicators from RETURNED_FROM_MOSPI_APPROVER_DRAFT to RETURNED_FROM_MOSPI_APPROVER
        if (indicatorsToUpdate.length > 0) {
          await this.ministrySubmissionIndicatorRepository.update(
            {
              submissionId: In(submissionIds),
              status: SubmissionIndicatorStatus.RETURNED_FROM_MOSPI_APPROVER_DRAFT,
            },
            { status: SubmissionIndicatorStatus.RETURNED_FROM_MOSPI_APPROVER },
          );
        }
      }

      return {
        status: true,
        message: 'Form sent back successfully',
        data: {
          formId: formId,
          formStatus: FormStatus.RETURNED_FROM_MOSPI,
          consolidatedSubmissionUpdated: !!consolidatedSubmission,
          indicatorsUpdated: indicatorsUpdatedCount,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to send back form',
      );
    }
  }

  /**
   * MOSPI Approver: Accept form
   * 1. Update form status to ACCEPTED_BY_MOSPI
   * 2. Update consolidated submission status to APPROVED
   */
  async mospiApproverAccept(
    dto: MospiFormActionDto,
    userId: string,
  ): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Find form - MOSPI Approver can access any form, but if formId is provided, use it
      let form: Form | null = null;
      let formId: string;

      if (dto.formId) {
        form = await this.formRepository.findOne({
          where: { id: dto.formId },
        });
        if (!form) {
          throw new NotFoundException(`Form with id ${dto.formId} not found`);
        }
        formId = dto.formId;
      } else {
        // If formId not provided, find a form that needs MOSPI Approver action
        // Find forms with status SUBMITTED_TO_MOSPI_APPROVER
        form = await this.formRepository.findOne({
          where: { status: FormStatus.SUBMITTED_TO_MOSPI_APPROVER },
          order: { updatedAt: 'DESC' },
        });
        if (!form) {
          throw new NotFoundException('No form found for MOSPI Approver action');
        }
        formId = form.id;
      }

      // Step 1: Update form status to ACCEPTED_BY_MOSPI
      await this.formRepository.update(
        { id: formId },
        { status: FormStatus.ACCEPTED_BY_MOSPI },
      );

      // Step 2: Find and update consolidated submission
      const consolidatedSubmission = await this.ministrySubmissionRepository.findOne({
        where: {
          formId: formId,
          isConsolidated: true,
        },
      });

      if (consolidatedSubmission) {
        // Update consolidated submission status to APPROVED
        await this.ministrySubmissionRepository.update(
          { id: consolidatedSubmission.id },
          { status: MinistrySubmissionStatus.APPROVED },
        );
      }

      return {
        status: true,
        message: 'Form accepted successfully',
        data: {
          formId: formId,
          formStatus: FormStatus.ACCEPTED_BY_MOSPI,
          consolidatedSubmissionUpdated: !!consolidatedSubmission,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to accept form',
      );
    }
  }

  /**
   * MOSPI Reviewer: Submit form to MOSPI Approver
   * 1. Update form status to SUBMITTED_TO_MOSPI_APPROVER
   * 2. Update consolidated submission status to SUBMITTED_TO_MOSPI_APPROVER
   */
  async mospiReviewerSubmitToApprover(
    dto: MospiFormActionDto,
    userId: string,
  ): Promise<{
    status: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Find form - MOSPI Reviewer can only access forms where reviewer = userId
      let form: Form | null = null;
      let formId: string;

      if (dto.formId) {
        form = await this.formRepository.findOne({
          where: {
            id: dto.formId,
            reviewer: userId,
          },
        });
        if (!form) {
          throw new NotFoundException(
            `Form with id ${dto.formId} not found for reviewer ${userId}`,
          );
        }
        formId = dto.formId;
      } else {
        // If formId not provided, find any form for this reviewer
        form = await this.formRepository.findOne({
          where: {
            reviewer: userId,
            status: FormStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          },
          order: { updatedAt: 'DESC' },
        });
        if (!form) {
          throw new NotFoundException(
            `No form found for reviewer ${userId}`,
          );
        }
        formId = form.id;
      }

      // Step 1: Update form status to SUBMITTED_TO_MOSPI_APPROVER
      await this.formRepository.update(
        { id: formId },
        { status: FormStatus.SUBMITTED_TO_MOSPI_APPROVER },
      );

      // Step 2: Find and update consolidated submission
      const consolidatedSubmission = await this.ministrySubmissionRepository.findOne({
        where: {
          formId: formId,
          isConsolidated: true,
        },
      });

      if (consolidatedSubmission) {
        // Update consolidated submission status to SUBMITTED_TO_MOSPI_APPROVER
        await this.ministrySubmissionRepository.update(
          { id: consolidatedSubmission.id },
          { status: MinistrySubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER },
        );
      }

      return {
        status: true,
        message: 'Form submitted to MOSPI Approver successfully',
        data: {
          formId: formId,
          formStatus: FormStatus.SUBMITTED_TO_MOSPI_APPROVER,
          consolidatedSubmissionUpdated: !!consolidatedSubmission,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to submit form to MOSPI Approver',
      );
    }
  }

  /**
   * Delete file data based on action type
   * Action: by-submission-indicator - Delete all file field rows for a submission indicator
   * Action: by-primary-id - Delete a specific row by primary ID
   */
  async deleteFileData(
    dto: DeleteFileDataDto,
  ): Promise<{
    status: boolean;
    message: string;
    deletedCount?: number;
  }> {
    try {
      if (dto.action === DeleteFileAction.BY_SUBMISSION_INDICATOR) {
        // Action: Delete all file field rows for a submission indicator
        if (!dto.submissionIndicatorId) {
          throw new BadRequestException(
            'submissionIndicatorId is required for by-submission-indicator action',
          );
        }

        // Step 1: Verify submission indicator exists
        const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
          where: { id: dto.submissionIndicatorId },
        });

        if (!submissionIndicator) {
          throw new NotFoundException(
            `Submission indicator with id ${dto.submissionIndicatorId} not found`,
          );
        }

        // Step 2: Get all submission data for this submission indicator
        const allSubmissionData = await this.ministrySubmissionDataRepository.find({
          where: { submissionIndicatorId: dto.submissionIndicatorId },
        });

        if (allSubmissionData.length === 0) {
          return {
            status: true,
            message: 'No submission data found for this submission indicator',
            deletedCount: 0,
          };
        }

        // Step 3: Get input field IDs from submission data
        const inputFieldIds = allSubmissionData.map((data) => data.inputFieldId);

        // Step 4: Get input fields to check which ones are file type
        const inputFields = await this.inputFieldRepository.find({
          where: { id: In(inputFieldIds) },
        });

        // Step 5: Filter to get only file type input field IDs
        const fileInputFieldIds = inputFields
          .filter((field) => field.dataType === DataType.FILE)
          .map((field) => field.id);

        if (fileInputFieldIds.length === 0) {
          return {
            status: true,
            message: 'No file fields found for this submission indicator',
            deletedCount: 0,
          };
        }

        // Step 6: Find all submission data rows that have file type input fields
        const fileDataRows = allSubmissionData.filter((data) =>
          fileInputFieldIds.includes(data.inputFieldId),
        );

        if (fileDataRows.length === 0) {
          return {
            status: true,
            message: 'No file data found to delete',
            deletedCount: 0,
          };
        }

        // Step 7: Delete all file data rows
        const fileDataIds = fileDataRows.map((row) => row.id);
        const deleteResult = await this.ministrySubmissionDataRepository.delete({
          id: In(fileDataIds),
        });

        return {
          status: true,
          message: `Successfully deleted ${deleteResult.affected || 0} file data row(s)`,
          deletedCount: deleteResult.affected || 0,
        };
      } else if (dto.action === DeleteFileAction.BY_PRIMARY_ID) {
        // Action: Delete a specific row by primary ID
        if (!dto.primaryId) {
          throw new BadRequestException(
            'primaryId is required for by-primary-id action',
          );
        }

        // Step 1: Find the row with the provided primaryId
        const rowToDelete = await this.ministrySubmissionDataRepository.findOne({
          where: { id: dto.primaryId },
        });

        if (!rowToDelete) {
          throw new NotFoundException(
            `Submission data with primaryId ${dto.primaryId} not found`,
          );
        }

        // Step 2: Verify it's a file type field
        const inputField = await this.inputFieldRepository.findOne({
          where: { id: rowToDelete.inputFieldId },
        });

        if (!inputField) {
          throw new NotFoundException(
            `Input field with id ${rowToDelete.inputFieldId} not found`,
          );
        }

        if (inputField.dataType !== DataType.FILE) {
          throw new BadRequestException(
            `Row with primaryId ${dto.primaryId} is not a file field. It is of type ${inputField.dataType}`,
          );
        }

        // Step 3: Delete the row
        const deleteResult = await this.ministrySubmissionDataRepository.delete({
          id: dto.primaryId,
        });

        return {
          status: true,
          message: `Successfully deleted file data row`,
          deletedCount: deleteResult.affected || 0,
        };
      } else {
        throw new BadRequestException(`Invalid action: ${dto.action}`);
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to delete file data',
      );
    }
  }
}
