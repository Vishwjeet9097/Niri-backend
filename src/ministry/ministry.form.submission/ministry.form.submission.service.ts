import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MinistrySubmissionIndicator, SubmissionIndicatorStatus } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField, DataType } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';
import { Form, FormStatus } from '../entities/form.entity';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';
import { UpdateSubmissionIndicatorStatusDto } from './dto/update-submission-indicator-status.dto';
import { UpdateFormStatusDto } from './dto/update-form-status.dto';

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

      // Check if status is already DRAFT - if yes, return error
      if (submissionIndicator.status === SubmissionIndicatorStatus.DRAFT) {
        throw new BadRequestException('Data already submitted. Status is already DRAFT.');
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
      for (const subsectionArray of dto.data.subsection) {
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
          );

          savedData.push(submissionData);
        }
      }

      // Step 6: Save all data to database
      const saved = await this.ministrySubmissionDataRepository.save(savedData);

      // Step 7: Update submission indicator status to DRAFT
      await this.ministrySubmissionIndicatorRepository.update(
        { id: dto.submissionIndicatorId },
        { status: SubmissionIndicatorStatus.DRAFT }
      );

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
  ): MinistrySubmissionData {
    const submissionData = new MinistrySubmissionData();
    submissionData.submissionIndicatorId = submissionIndicatorId;
    submissionData.inputFieldId = inputFieldId;
    
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

      return {
        status: true,
        message: 'Form status updated successfully',
        data: {
          formId: formId,
          newStatus: dto.status,
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
}
