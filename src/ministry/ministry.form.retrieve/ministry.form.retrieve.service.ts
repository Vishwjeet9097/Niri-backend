import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';

@Injectable()
export class MinistryFormRetrieveService {
  constructor(
    @InjectRepository(MinistrySubmission)
    private readonly ministrySubmissionRepository: Repository<MinistrySubmission>,
    @InjectRepository(MinistrySubmissionIndicator)
    private readonly ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
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
   * Get submission details with indicators, subsections, and input fields
   * Retrieves submission by userId
   */
  async getSubmissionDetails(userId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
  }> {
    try {
      // Step 1: Get submission by userId (get the most recent one if multiple exist)
      const submission = await this.ministrySubmissionRepository.findOne({
        where: { userId: userId },
        order: { createdAt: 'DESC' },
      });

      if (!submission) {
        throw new NotFoundException(
          `Submission not found for user ID ${userId}`,
        );
      }

      const submissionId = submission.id;

      // Step 2: Get all indicators mapped to this submission
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: { submissionId: submission.id },
      });

      //console.log('submissionIndicators', submissionIndicators);

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No indicators mapped to this submission',
        };
      }

      const indicatorIds = submissionIndicators.map((si) => si.indicatorId);

      // Create a map of indicatorId -> submissionIndicatorId
      const submissionIndicatorMap = new Map<string, string>();
      submissionIndicators.forEach((si) => {
        submissionIndicatorMap.set(si.indicatorId, si.id);
      });

      // Step 3: Get indicator details
      const indicators = await this.indicatorDetailRepository.find({
        where: { id: In(indicatorIds) },
        order: { sequence: 'ASC', sNo: 'ASC' },
      });

      // Step 4: Get subsections for all indicators
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: In(indicatorIds), status: true },
        order: { sequence: 'ASC', name: 'ASC' },
      });

      // Step 5: Get input fields for indicators (direct)
      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(indicatorIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 6: Get subsection IDs and their input fields
      const subsectionIds = subsections.map((sub) => sub.id);
      const subsectionInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(subsectionIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 7: Group subsections by indicator
      const subsectionsByIndicator: Record<string, IndicatorSubsection[]> = {};
      subsections.forEach((subsection) => {
        if (!subsectionsByIndicator[subsection.indicatorId]) {
          subsectionsByIndicator[subsection.indicatorId] = [];
        }
        subsectionsByIndicator[subsection.indicatorId].push(subsection);
      });

      // Step 8: Group input fields by section
      const inputFieldsBySection: Record<string, InputField[]> = {};
      [...indicatorInputFields, ...subsectionInputFields].forEach((inputField) => {
        if (!inputFieldsBySection[inputField.sectionId]) {
          inputFieldsBySection[inputField.sectionId] = [];
        }
        inputFieldsBySection[inputField.sectionId].push(inputField);
      });

      // Step 9: Group indicators by category
      const indicatorsByCategory: Record<string, IndicatorDetail[]> = {};
      indicators.forEach((indicator) => {
        const category = indicator.category;
        if (!indicatorsByCategory[category]) {
          indicatorsByCategory[category] = [];
        }
        indicatorsByCategory[category].push(indicator);
      });

      // Step 10: Build the response structure
      const result: any[] = [];

      Object.keys(indicatorsByCategory).forEach((categoryName) => {
        const categoryIndicators = indicatorsByCategory[categoryName];

        const indicatorArray = categoryIndicators.map((indicator) => {
          // Get subsections for this indicator
          const indicatorSubsections = subsectionsByIndicator[indicator.id] || [];

          // Build subsection array with inputs
          const subsectionArray = indicatorSubsections.map((subsection) => {
            const subsectionInputs = inputFieldsBySection[subsection.id] || [];
            return {
              [subsection.name]: {
                inputs: subsectionInputs,
              },
            };
          });

          // Get direct inputs for this indicator
          const indicatorInputs = inputFieldsBySection[indicator.id] || [];

          // Get submission indicator ID for this indicator
          const submissionIndicatorId = submissionIndicatorMap.get(indicator.id);

          // Build indicator object
          return {
            [indicator.name]: {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
              submissionIndicatorId: submissionIndicatorId || null,
              inputs: indicatorInputs,
              subsection: subsectionArray,
            },
          };
        });

        // Add category object to result
        result.push({
          [categoryName]: indicatorArray,
        });
      });

      return {
        status: true,
        data: result,
        message: `Retrieved ${indicators.length} indicator(s) for submission`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to retrieve submission details',
      );
    }
  }

  /**
   * Get submission details with indicators, subsections, input fields, and submitted data
   * Retrieves submission by userId and includes submitted data from ministry_submission_data table
   */
  async getSubmissionDetailsWithData(userId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
  }> {
    try {
      // Step 1: Get submission by userId (get the most recent one if multiple exist)
      const submission = await this.ministrySubmissionRepository.findOne({
        where: { userId: userId },
        order: { createdAt: 'DESC' },
      });

      if (!submission) {
        throw new NotFoundException(
          `Submission not found for user ID ${userId}`,
        );
      }

      const submissionId = submission.id;

      // Step 2: Get all indicators mapped to this submission
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: { submissionId: submissionId },
      });

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No indicators mapped to this submission',
        };
      }

      const indicatorIds = submissionIndicators.map((si) => si.indicatorId);

      // Create a map of indicatorId -> submissionIndicatorId
      const submissionIndicatorMap = new Map<string, string>();
      submissionIndicators.forEach((si) => {
        submissionIndicatorMap.set(si.indicatorId, si.id);
      });

      // Step 3: Get indicator details
      const indicators = await this.indicatorDetailRepository.find({
        where: { id: In(indicatorIds) },
        order: { sequence: 'ASC', sNo: 'ASC' },
      });

      // Step 4: Get subsections for all indicators
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: In(indicatorIds), status: true },
        order: { sequence: 'ASC', name: 'ASC' },
      });

      // Step 5: Get input fields for indicators (direct)
      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(indicatorIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 6: Get subsection IDs and their input fields
      const subsectionIds = subsections.map((sub) => sub.id);
      const subsectionInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(subsectionIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 7: Get all submission data for these submission indicators
      const submissionIndicatorIds = submissionIndicators.map((si) => si.id);
      const allSubmissionData = await this.ministrySubmissionDataRepository.find({
        where: { submissionIndicatorId: In(submissionIndicatorIds) },
      });

      // Step 8: Create a map of (submissionIndicatorId, inputFieldId) -> submission data
      const submissionDataMap = new Map<string, MinistrySubmissionData>();
      allSubmissionData.forEach((data) => {
        const key = `${data.submissionIndicatorId}_${data.inputFieldId}`;
        submissionDataMap.set(key, data);
      });

      // Step 9: Group subsections by indicator
      const subsectionsByIndicator: Record<string, IndicatorSubsection[]> = {};
      subsections.forEach((subsection) => {
        if (!subsectionsByIndicator[subsection.indicatorId]) {
          subsectionsByIndicator[subsection.indicatorId] = [];
        }
        subsectionsByIndicator[subsection.indicatorId].push(subsection);
      });

      // Step 10: Group input fields by section
      const inputFieldsBySection: Record<string, InputField[]> = {};
      [...indicatorInputFields, ...subsectionInputFields].forEach((inputField) => {
        if (!inputFieldsBySection[inputField.sectionId]) {
          inputFieldsBySection[inputField.sectionId] = [];
        }
        inputFieldsBySection[inputField.sectionId].push(inputField);
      });

      // Step 11: Group indicators by category
      const indicatorsByCategory: Record<string, IndicatorDetail[]> = {};
      indicators.forEach((indicator) => {
        const category = indicator.category;
        if (!indicatorsByCategory[category]) {
          indicatorsByCategory[category] = [];
        }
        indicatorsByCategory[category].push(indicator);
      });

      // Step 12: Build the response structure with submitted data
      const result: any[] = [];

      Object.keys(indicatorsByCategory).forEach((categoryName) => {
        const categoryIndicators = indicatorsByCategory[categoryName];

        const indicatorArray = categoryIndicators.map((indicator) => {
          // Get subsections for this indicator
          const indicatorSubsections = subsectionsByIndicator[indicator.id] || [];
          const submissionIndicatorId = submissionIndicatorMap.get(indicator.id);

          // Build subsection array with inputs and submitted data
          const subsectionArray = indicatorSubsections.map((subsection) => {
            const subsectionInputs = inputFieldsBySection[subsection.id] || [];
            
            // Add submittedData to each input
            const inputsWithData = subsectionInputs.map((input) => {
              const dataKey = submissionIndicatorId ? `${submissionIndicatorId}_${input.id}` : null;
              const submittedData = dataKey ? submissionDataMap.get(dataKey) : null;
              
              return {
                ...input,
                submittedData: submittedData ? {
                  valueText: submittedData.valueText,
                  valueNumber: submittedData.valueNumber,
                  valueDate: submittedData.valueDate,
                  valueJson: submittedData.valueJson,
                } : null,
              };
            });

            return {
              [subsection.name]: {
                inputs: inputsWithData,
              },
            };
          });

          // Get direct inputs for this indicator
          const indicatorInputs = inputFieldsBySection[indicator.id] || [];
          
          // Add submittedData to each input
          const inputsWithData = indicatorInputs.map((input) => {
            const dataKey = submissionIndicatorId ? `${submissionIndicatorId}_${input.id}` : null;
            const submittedData = dataKey ? submissionDataMap.get(dataKey) : null;
            
            return {
              ...input,
              submittedData: submittedData ? {
                valueText: submittedData.valueText,
                valueNumber: submittedData.valueNumber,
                valueDate: submittedData.valueDate,
                valueJson: submittedData.valueJson,
              } : null,
            };
          });

          // Build indicator object
          return {
            [indicator.name]: {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
              submissionIndicatorId: submissionIndicatorId || null,
              inputs: inputsWithData,
              subsection: subsectionArray,
            },
          };
        });

        // Add category object to result
        result.push({
          [categoryName]: indicatorArray,
        });
      });

      return {
        status: true,
        data: result,
        message: `Retrieved ${indicators.length} indicator(s) with submitted data for submission`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to retrieve submission details with data',
      );
    }
  }
}
