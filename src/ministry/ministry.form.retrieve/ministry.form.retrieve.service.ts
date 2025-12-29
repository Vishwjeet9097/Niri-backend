import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';

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
  ) {}

  /**
   * Get submission details with indicators, subsections, and input fields
   */
  async getSubmissionDetails(submissionId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
  }> {
    try {
      // Step 1: Verify submission exists
      const submission = await this.ministrySubmissionRepository.findOne({
        where: { id: submissionId },
      });

      if (!submission) {
        throw new NotFoundException(
          `Submission with ID ${submissionId} not found`,
        );
      }

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

          // Build indicator object
          return {
            [indicator.name]: {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
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
}
