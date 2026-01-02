import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField, DataType } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';

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
}
