import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';
import { User } from '../../entities/user.entity';
import { Ministry } from '../../entities/ministry.entity';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ministry)
    private readonly ministryRepository: Repository<Ministry>,
  ) {}

  /**
   * Get submission details with indicators, subsections, and input fields
   * Retrieves submission by userId
   */
  async getSubmissionDetails(userId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
    submissionId?: string;
    id?: string; // UUID of the submission (needed for submission-with-data endpoint)
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

      // Use UUID for querying (ministry_submission_indicator.submission_id references ministry_submission.id)
      const submissionUuid = submission.id;
      // Use SUB- format for file paths and API response
      const submissionId = submission.submissionId;

      // Step 2: Get all indicators mapped to this submission
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: { submissionId: submissionUuid },
      });

      //console.log('submissionIndicators', submissionIndicators);

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No indicators mapped to this submission',
          submissionId: submissionId, // Use SUB- format for file paths
          id: submissionUuid, // UUID for calling submission-with-data endpoint
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
        submissionId: submissionId, // Use SUB- format for file paths (not UUID)
        id: submissionUuid, // UUID for calling submission-with-data endpoint
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
   * Retrieves submission by submissionId and includes submitted data from ministry_submission_data table
   * If forReview is true, only returns indicators with status not null
   */
  async getSubmissionDetailsWithData(submissionId: string, forReview?: boolean): Promise<{
    status: boolean;
    data: any[];
    message: string;
    submissionId?: string;
  }> {
    try {
      // Step 1: Get submission by submissionId (format: SUB-{year}-{randomNum})
      const submission = await this.ministrySubmissionRepository.findOne({
        where: { id: submissionId },
      });

      if (!submission) {
        throw new NotFoundException(
          `Submission not found for submission ID ${submissionId}`,
        );
      }

      // Use UUID for querying (ministry_submission_indicator.submission_id references ministry_submission.id)
      const submissionUuid = submission.id;
      // submissionId parameter is already in SUB- format (SUB-{year}-{randomNum})

      // Step 2: Get all indicators mapped to this submission
      // If forReview is true, filter by status not null and not 'DRAFT'
      let submissionIndicators;
      if (forReview === true) {
        // Only include indicators whose status is neither null nor 'DRAFT'
        // Use query builder to properly handle both conditions with AND logic
        submissionIndicators = await this.ministrySubmissionIndicatorRepository
          .createQueryBuilder('msi')
          .where('msi.submissionId = :submissionUuid', { submissionUuid })
          .andWhere('msi.status IS NOT NULL')
          .andWhere('msi.status != :draftStatus', { draftStatus: 'DRAFT' })
          .getMany();
      } else {
        submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
          where: { submissionId: submissionUuid },
        });
      }

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No indicators mapped to this submission',
          submissionId: submissionId, // Use SUB- format for file paths
        };
      }

      const indicatorIds = submissionIndicators.map((si) => si.indicatorId);

      // Create a map of indicatorId -> submissionIndicatorId
      const submissionIndicatorMap = new Map<string, string>();
      // Create a map of indicatorId -> status
      const indicatorStatusMap = new Map<string, string | null>();
      submissionIndicators.forEach((si) => {
        submissionIndicatorMap.set(si.indicatorId, si.id);
        indicatorStatusMap.set(si.indicatorId, si.status);
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
            
            // Create a map of inputFieldId -> InputField for easy access to dataType
            const inputFieldMap = new Map<string, InputField>();
            subsectionInputs.forEach((input) => {
              inputFieldMap.set(input.id, input);
            });
            
            // Get all submitted data for this subsection from allSubmissionData
            // Filter by submissionIndicatorId and inputFieldIds in this subsection
            const subsectionInputIds = subsectionInputs.map((input) => input.id);
            const allSubmittedDataForSubsection = allSubmissionData.filter((data) => {
              return data.submissionIndicatorId === submissionIndicatorId && 
                     subsectionInputIds.includes(data.inputFieldId);
            });
            
            // Group by sequence: each sequence number gets its own array
            const sequenceGroups: Map<number | null, MinistrySubmissionData[]> = new Map();
            allSubmittedDataForSubsection.forEach((data) => {
              const sequence = data.sequence;
              if (!sequenceGroups.has(sequence)) {
                sequenceGroups.set(sequence, []);
              }
              sequenceGroups.get(sequence)!.push(data);
            });
            
            // Convert to submittedItems array: [[all data with seq 1], [all data with seq 2], ...]
            const submittedItems: any[][] = [];
            
            // Sort sequences (null sequences last)
            const sortedSequences = Array.from(sequenceGroups.entries())
              .sort((a, b) => {
                // Sort null sequences last
                if (a[0] === null && b[0] !== null) return 1;
                if (a[0] !== null && b[0] === null) return -1;
                if (a[0] === null && b[0] === null) return 0;
                // Sort by sequence number
                return (a[0] as number) - (b[0] as number);
              });
            
            // For each sequence group, create an array with all data items
            sortedSequences.forEach(([sequence, groupData]) => {
              const row: any[] = [];
              groupData.forEach((data) => {
                const inputField = inputFieldMap.get(data.inputFieldId);
                if (inputField) {
                  row.push({
                    inputId: data.inputFieldId,
                    dataType: inputField.dataType,
                    valueText: data.valueText,
                    valueNumber: data.valueNumber,
                    valueDate: data.valueDate,
                    valueJson: data.valueJson,
                  });
                }
              });
              
              // Only add row if it has at least one value
              if (row.length > 0) {
                submittedItems.push(row);
              }
            });
            
            // For subsections, don't include submittedData in inputs - only in submittedItems
            const inputsWithData = subsectionInputs.map((input) => {
              return {
                ...input,
              };
            });

            return {
              [subsection.name]: {
                inputs: inputsWithData,
                submittedItems: submittedItems.length > 0 ? submittedItems : undefined,
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

          // Get status for this indicator
          const indicatorStatus = indicatorStatusMap.get(indicator.id) || null;

          // Build indicator object
          return {
            [indicator.name]: {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
              submissionIndicatorId: submissionIndicatorId || null,
              status: indicatorStatus,
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

      const response = {
        status: true,
        data: result,
        message: `Retrieved ${indicators.length} indicator(s) with submitted data for submission`,
        submissionId: submissionId, // Use SUB- format for file paths (not UUID)
      };
      
      // CRITICAL: Log to verify submissionId is being returned
      console.log('[getSubmissionDetailsWithData] Returning response with submissionId:', {
        hasSubmissionId: !!response.submissionId,
        submissionId: response.submissionId,
        submissionIdType: typeof response.submissionId,
        responseKeys: Object.keys(response)
      });
      
      return response;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to retrieve submission details with data',
      );
    }
  }

  /**
   * Get consolidated submission details with data from all other submissions in the same form
   * Checks if submission is consolidated, gets formId, then aggregates data from all other submissions
   * Returns data in the same format as getSubmissionDetailsWithData but with submission details from the consolidated submission
   */
  async getConsolidatedSubmissionDetailsWithData(submissionId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
    submissionId?: string;
    submission?: any;
  }> {
    try {
      // Step 1: Get the consolidated submission by submissionId (UUID)
      const consolidatedSubmission = await this.ministrySubmissionRepository.findOne({
        where: { id: submissionId },
      });

      if (!consolidatedSubmission) {
        throw new NotFoundException(
          `Submission not found for submission ID ${submissionId}`,
        );
      }

      // Step 2: Check if submission is consolidated
      if (!consolidatedSubmission.isConsolidated) {
        throw new BadRequestException(
          `Submission ${submissionId} is not a consolidated submission`,
        );
      }

      // Step 3: Get formId from the consolidated submission
      const formId = consolidatedSubmission.formId;
      if (!formId) {
        throw new BadRequestException(
          `Consolidated submission ${submissionId} does not have a formId`,
        );
      }

      // Step 4: Get all other submissions for this formId (excluding the consolidated one)
      const otherSubmissions = await this.ministrySubmissionRepository.find({
        where: {
          formId: formId,
          id: Not(submissionId), // Exclude the consolidated submission
        },
      });

      if (otherSubmissions.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No other submissions found for this form',
          submissionId: consolidatedSubmission.submissionId,
          submission: {
            id: consolidatedSubmission.id,
            submissionId: consolidatedSubmission.submissionId,
            userId: consolidatedSubmission.userId,
            formId: consolidatedSubmission.formId,
            status: consolidatedSubmission.status,
            isConsolidated: consolidatedSubmission.isConsolidated,
            createdAt: consolidatedSubmission.createdAt,
            updatedAt: consolidatedSubmission.updatedAt,
          },
        };
      }

      // Step 5: Get all submission UUIDs from other submissions
      const otherSubmissionUuids = otherSubmissions.map((s) => s.id);

      // Step 6: Get all indicators mapped to these other submissions
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: { submissionId: In(otherSubmissionUuids) },
      });

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No indicators mapped to other submissions',
          submissionId: consolidatedSubmission.submissionId,
          submission: {
            id: consolidatedSubmission.id,
            submissionId: consolidatedSubmission.submissionId,
            userId: consolidatedSubmission.userId,
            formId: consolidatedSubmission.formId,
            status: consolidatedSubmission.status,
            isConsolidated: consolidatedSubmission.isConsolidated,
            createdAt: consolidatedSubmission.createdAt,
            updatedAt: consolidatedSubmission.updatedAt,
          },
        };
      }

      const indicatorIds = submissionIndicators.map((si) => si.indicatorId);

      // Create a map of indicatorId -> array of submissionIndicatorIds (since multiple submissions can have same indicator)
      const submissionIndicatorMap = new Map<string, string[]>();
      const indicatorStatusMap = new Map<string, string | null>();
      submissionIndicators.forEach((si) => {
        if (!submissionIndicatorMap.has(si.indicatorId)) {
          submissionIndicatorMap.set(si.indicatorId, []);
        }
        submissionIndicatorMap.get(si.indicatorId)!.push(si.id);
        // Use the first status found (or most recent if needed)
        if (!indicatorStatusMap.has(si.indicatorId)) {
          indicatorStatusMap.set(si.indicatorId, si.status);
        }
      });

      // Step 7: Get indicator details
      const indicators = await this.indicatorDetailRepository.find({
        where: { id: In(indicatorIds) },
        order: { sequence: 'ASC', sNo: 'ASC' },
      });

      // Step 8: Get subsections for all indicators
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: In(indicatorIds), status: true },
        order: { sequence: 'ASC', name: 'ASC' },
      });

      // Step 9: Get input fields for indicators (direct)
      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(indicatorIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 10: Get subsection IDs and their input fields
      const subsectionIds = subsections.map((sub) => sub.id);
      const subsectionInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(subsectionIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 11: Get all submission data for these submission indicators
      const allSubmissionIndicatorIds = submissionIndicators.map((si) => si.id);
      const allSubmissionData = await this.ministrySubmissionDataRepository.find({
        where: { submissionIndicatorId: In(allSubmissionIndicatorIds) },
      });

      // Step 12: Create a map of (submissionIndicatorId, inputFieldId) -> submission data
      const submissionDataMap = new Map<string, MinistrySubmissionData[]>();
      allSubmissionData.forEach((data) => {
        const key = `${data.submissionIndicatorId}_${data.inputFieldId}`;
        if (!submissionDataMap.has(key)) {
          submissionDataMap.set(key, []);
        }
        submissionDataMap.get(key)!.push(data);
      });

      // Step 13: Group subsections by indicator
      const subsectionsByIndicator: Record<string, IndicatorSubsection[]> = {};
      subsections.forEach((subsection) => {
        if (!subsectionsByIndicator[subsection.indicatorId]) {
          subsectionsByIndicator[subsection.indicatorId] = [];
        }
        subsectionsByIndicator[subsection.indicatorId].push(subsection);
      });

      // Step 14: Group input fields by section
      const inputFieldsBySection: Record<string, InputField[]> = {};
      [...indicatorInputFields, ...subsectionInputFields].forEach((inputField) => {
        if (!inputFieldsBySection[inputField.sectionId]) {
          inputFieldsBySection[inputField.sectionId] = [];
        }
        inputFieldsBySection[inputField.sectionId].push(inputField);
      });

      // Step 15: Group indicators by category
      const indicatorsByCategory: Record<string, IndicatorDetail[]> = {};
      indicators.forEach((indicator) => {
        const category = indicator.category;
        if (!indicatorsByCategory[category]) {
          indicatorsByCategory[category] = [];
        }
        indicatorsByCategory[category].push(indicator);
      });

      // Step 16: Build the response structure with aggregated submitted data
      const result: any[] = [];

      Object.keys(indicatorsByCategory).forEach((categoryName) => {
        const categoryIndicators = indicatorsByCategory[categoryName];

        const indicatorArray = categoryIndicators.map((indicator) => {
          // Get subsections for this indicator
          const indicatorSubsections = subsectionsByIndicator[indicator.id] || [];
          const submissionIndicatorIds = submissionIndicatorMap.get(indicator.id) || [];

          // Build subsection array with inputs and submitted data
          const subsectionArray = indicatorSubsections.map((subsection) => {
            const subsectionInputs = inputFieldsBySection[subsection.id] || [];
            
            // Create a map of inputFieldId -> InputField for easy access to dataType
            const inputFieldMap = new Map<string, InputField>();
            subsectionInputs.forEach((input) => {
              inputFieldMap.set(input.id, input);
            });
            
            // Get all submitted data for this subsection from allSubmissionData
            // Filter by submissionIndicatorIds and inputFieldIds in this subsection
            const subsectionInputIds = subsectionInputs.map((input) => input.id);
            const allSubmittedDataForSubsection = allSubmissionData.filter((data) => {
              return submissionIndicatorIds.includes(data.submissionIndicatorId) && 
                     subsectionInputIds.includes(data.inputFieldId);
            });
            
            // Group by sequence: each sequence number gets its own array
            const sequenceGroups: Map<number | null, MinistrySubmissionData[]> = new Map();
            allSubmittedDataForSubsection.forEach((data) => {
              const sequence = data.sequence;
              if (!sequenceGroups.has(sequence)) {
                sequenceGroups.set(sequence, []);
              }
              sequenceGroups.get(sequence)!.push(data);
            });
            
            // Convert to submittedItems array: [[all data with seq 1], [all data with seq 2], ...]
            const submittedItems: any[][] = [];
            
            // Sort sequences (null sequences last)
            const sortedSequences = Array.from(sequenceGroups.entries())
              .sort((a, b) => {
                // Sort null sequences last
                if (a[0] === null && b[0] !== null) return 1;
                if (a[0] !== null && b[0] === null) return -1;
                if (a[0] === null && b[0] === null) return 0;
                // Sort by sequence number
                return (a[0] as number) - (b[0] as number);
              });
            
            // For each sequence group, create an array with all data items
            sortedSequences.forEach(([sequence, groupData]) => {
              const row: any[] = [];
              groupData.forEach((data) => {
                const inputField = inputFieldMap.get(data.inputFieldId);
                if (inputField) {
                  row.push({
                    inputId: data.inputFieldId,
                    dataType: inputField.dataType,
                    valueText: data.valueText,
                    valueNumber: data.valueNumber,
                    valueDate: data.valueDate,
                    valueJson: data.valueJson,
                  });
                }
              });
              
              if (row.length > 0) {
                submittedItems.push(row);
              }
            });
            
            // For subsections, don't include submittedData in inputs - only in submittedItems
            const inputsWithData = subsectionInputs.map((input) => {
              return {
                ...input,
              };
            });

            return {
              [subsection.name]: {
                inputs: inputsWithData,
                submittedItems: submittedItems.length > 0 ? submittedItems : undefined,
              },
            };
          });

          // Get direct inputs for this indicator
          const indicatorInputs = inputFieldsBySection[indicator.id] || [];
          
          // Add submittedData to each input (aggregate from all submission indicators)
          const inputsWithData = indicatorInputs.map((input) => {
            // Get all data for this input from all submission indicators
            const allDataForInput: MinistrySubmissionData[] = [];
            submissionIndicatorIds.forEach((submissionIndicatorId) => {
              const dataKey = `${submissionIndicatorId}_${input.id}`;
              const dataArray = submissionDataMap.get(dataKey) || [];
              allDataForInput.push(...dataArray);
            });
            
            // Use the most recent data
            const submittedData = allDataForInput.length > 0
              ? allDataForInput.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
              : null;
            
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

          // Get status for this indicator (from first occurrence)
          const indicatorStatus = indicatorStatusMap.get(indicator.id) || null;

          // Build indicator object
          return {
            [indicator.name]: {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
              submissionIndicatorId: submissionIndicatorIds.length > 0 ? submissionIndicatorIds[0] : null, // Use first one
              status: indicatorStatus,
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

      const response = {
        status: true,
        data: result,
        message: `Retrieved ${indicators.length} indicator(s) with aggregated data from ${otherSubmissions.length} submission(s)`,
        submissionId: consolidatedSubmission.submissionId,
        submission: {
          id: consolidatedSubmission.id,
          submissionId: consolidatedSubmission.submissionId,
          userId: consolidatedSubmission.userId,
          formId: consolidatedSubmission.formId,
          status: consolidatedSubmission.status,
          isConsolidated: consolidatedSubmission.isConsolidated,
          createdAt: consolidatedSubmission.createdAt,
          updatedAt: consolidatedSubmission.updatedAt,
        },
      };
      
      return response;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to retrieve consolidated submission details with data',
      );
    }
  }

  /**
   * Get submissionId from submissionIndicatorId
   * This is a workaround endpoint to get submissionId when it's not in the main response
   */
  async getSubmissionIdFromIndicator(submissionIndicatorId: string): Promise<{
    submissionId: string | null;
  }> {
    try {
      const submissionIndicator = await this.ministrySubmissionIndicatorRepository.findOne({
        where: { id: submissionIndicatorId },
      });

      if (!submissionIndicator) {
        return { submissionId: null };
      }

      // submissionIndicator.submissionId is the UUID (ministry_submission.id)
      // We need to get the ministry_submission record to get the SUB- format submissionId
      const ministrySubmission = await this.ministrySubmissionRepository.findOne({
        where: { id: submissionIndicator.submissionId },
      });

      if (!ministrySubmission) {
        return { submissionId: null };
      }

      // Return the SUB- format submissionId for file paths
      return { submissionId: ministrySubmission.submissionId };
    } catch (error) {
      console.error('[getSubmissionIdFromIndicator] Error:', error);
      return { submissionId: null };
    }
  }

  /**
   * Preview API: Get all indicator details with inputs and submitted data for a ministry user
   * Retrieves all indicators where ministryUser = ministryUserId and status is not null and not DRAFT
   */
  async getPreviewByMinistryUser(ministryUserId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
  }> {
    try {
      // Step 1: Get all submission indicators where ministryUser = ministryUserId and status is not null and not DRAFT
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository
        .createQueryBuilder('msi')
        .where('msi.ministryUser = :ministryUserId', { ministryUserId })
        .andWhere('msi.status IS NOT NULL')
        .andWhere('msi.status != :draftStatus', { draftStatus: 'DRAFT' })
        .getMany();

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No indicators found with submitted status for this ministry user',
        };
      }

      const indicatorIds = submissionIndicators.map((si) => si.indicatorId);

      // Create a map of indicatorId -> submissionIndicatorId
      const submissionIndicatorMap = new Map<string, string>();
      // Create a map of indicatorId -> status
      const indicatorStatusMap = new Map<string, string | null>();
      submissionIndicators.forEach((si) => {
        submissionIndicatorMap.set(si.indicatorId, si.id);
        indicatorStatusMap.set(si.indicatorId, si.status);
      });

      // Step 2: Get indicator details
      const indicators = await this.indicatorDetailRepository.find({
        where: { id: In(indicatorIds) },
        order: { sequence: 'ASC', sNo: 'ASC' },
      });

      // Step 3: Get subsections for all indicators
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: In(indicatorIds), status: true },
        order: { sequence: 'ASC', name: 'ASC' },
      });

      // Step 4: Get input fields for indicators (direct)
      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(indicatorIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 5: Get subsection IDs and their input fields
      const subsectionIds = subsections.map((sub) => sub.id);
      const subsectionInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(subsectionIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Step 6: Get all submission data for these submission indicators
      const submissionIndicatorIds = submissionIndicators.map((si) => si.id);
      const allSubmissionData = await this.ministrySubmissionDataRepository.find({
        where: { submissionIndicatorId: In(submissionIndicatorIds) },
      });

      // Step 7: Create a map of (submissionIndicatorId, inputFieldId) -> submission data
      const submissionDataMap = new Map<string, MinistrySubmissionData>();
      allSubmissionData.forEach((data) => {
        const key = `${data.submissionIndicatorId}_${data.inputFieldId}`;
        submissionDataMap.set(key, data);
      });

      // Step 8: Group subsections by indicator
      const subsectionsByIndicator: Record<string, IndicatorSubsection[]> = {};
      subsections.forEach((subsection) => {
        if (!subsectionsByIndicator[subsection.indicatorId]) {
          subsectionsByIndicator[subsection.indicatorId] = [];
        }
        subsectionsByIndicator[subsection.indicatorId].push(subsection);
      });

      // Step 9: Group input fields by section
      const inputFieldsBySection: Record<string, InputField[]> = {};
      [...indicatorInputFields, ...subsectionInputFields].forEach((inputField) => {
        if (!inputFieldsBySection[inputField.sectionId]) {
          inputFieldsBySection[inputField.sectionId] = [];
        }
        inputFieldsBySection[inputField.sectionId].push(inputField);
      });

      // Step 10: Group indicators by category
      const indicatorsByCategory: Record<string, IndicatorDetail[]> = {};
      indicators.forEach((indicator) => {
        const category = indicator.category;
        if (!indicatorsByCategory[category]) {
          indicatorsByCategory[category] = [];
        }
        indicatorsByCategory[category].push(indicator);
      });

      // Step 11: Build the response structure with submitted data
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
            
            // Create a map of inputFieldId -> InputField for easy access to dataType
            const inputFieldMap = new Map<string, InputField>();
            subsectionInputs.forEach((input) => {
              inputFieldMap.set(input.id, input);
            });
            
            // Get all submitted data for this subsection from allSubmissionData
            // Filter by submissionIndicatorId and inputFieldIds in this subsection
            const subsectionInputIds = subsectionInputs.map((input) => input.id);
            const allSubmittedDataForSubsection = allSubmissionData.filter((data) => {
              return data.submissionIndicatorId === submissionIndicatorId && 
                     subsectionInputIds.includes(data.inputFieldId);
            });
            
            // Group by sequence: each sequence number gets its own array
            const sequenceGroups: Map<number | null, MinistrySubmissionData[]> = new Map();
            allSubmittedDataForSubsection.forEach((data) => {
              const sequence = data.sequence;
              if (!sequenceGroups.has(sequence)) {
                sequenceGroups.set(sequence, []);
              }
              sequenceGroups.get(sequence)!.push(data);
            });
            
            // Convert to submittedItems array: [[all data with seq 1], [all data with seq 2], ...]
            const submittedItems: any[][] = [];
            
            // Sort sequences (null sequences last)
            const sortedSequences = Array.from(sequenceGroups.entries())
              .sort((a, b) => {
                // Sort null sequences last
                if (a[0] === null && b[0] !== null) return 1;
                if (a[0] !== null && b[0] === null) return -1;
                if (a[0] === null && b[0] === null) return 0;
                // Sort by sequence number
                return (a[0] as number) - (b[0] as number);
              });
            
            // For each sequence group, create an array with all data items
            sortedSequences.forEach(([sequence, groupData]) => {
              const row: any[] = [];
              groupData.forEach((data) => {
                const inputField = inputFieldMap.get(data.inputFieldId);
                if (inputField) {
                  row.push({
                    inputId: data.inputFieldId,
                    dataType: inputField.dataType,
                    valueText: data.valueText,
                    valueNumber: data.valueNumber,
                    valueDate: data.valueDate,
                    valueJson: data.valueJson,
                  });
                }
              });
              
              // Only add row if it has at least one value
              if (row.length > 0) {
                submittedItems.push(row);
              }
            });
            
            // For subsections, don't include submittedData in inputs - only in submittedItems
            const inputsWithData = subsectionInputs.map((input) => {
              return {
                ...input,
              };
            });

            return {
              [subsection.name]: {
                inputs: inputsWithData,
                submittedItems: submittedItems.length > 0 ? submittedItems : undefined,
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

          // Get status for this indicator
          const indicatorStatus = indicatorStatusMap.get(indicator.id) || null;

          // Build indicator object
          return {
            [indicator.name]: {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
              submissionIndicatorId: submissionIndicatorId || null,
              status: indicatorStatus,
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
        message: `Retrieved ${indicators.length} indicator(s) with submitted data for ministry user`,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to retrieve preview data for ministry user',
      );
    }
  }

  /**
   * Get all ministry submissions for review
   * Returns a single submission with all indicators grouped by user
   * Since all indicators are submitted to the same submission ID
   */
  async getAllMinistrySubmissions(): Promise<{
    status: boolean;
    data: any;
    message: string;
  }> {
    try {
      // Get the latest ministry submission (most recent one)
      // Use find() with take(1) instead of findOne() without where clause
      const submissions = await this.ministrySubmissionRepository.find({
        order: { updatedAt: 'DESC' },
        take: 1,
      });

      if (!submissions || submissions.length === 0) {
        return {
          status: true,
          data: null,
          message: 'No ministry submission found',
        };
      }

      const submission = submissions[0];

      // Get all indicators for this submission
      const submissionUuid = submission.id;
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: { submissionId: submissionUuid },
      });

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          data: {
            id: submission.id,
            submissionId: submission.submissionId,
            userId: submission.userId,
            formId: submission.formId,
            status: submission.status,
            createdAt: submission.createdAt,
            updatedAt: submission.updatedAt,
            indicators: [],
            users: [],
          },
          message: 'No indicators found for this submission',
        };
      }

      // Get all unique user IDs from ministryUser field in submission indicators
      const userIds = new Set<string>();
      submissionIndicators.forEach((si) => {
        if (si.ministryUser) {
          userIds.add(si.ministryUser);
        }
        // Also include assignedTo if it's a user ID
        if (si.assignedTo) {
          userIds.add(si.assignedTo);
        }
      });

      // Get user details
      const users = await this.userRepository.find({
        where: { id: In(Array.from(userIds)) },
      });

      const userMap = new Map<string, User>();
      users.forEach(user => {
        userMap.set(user.id, user);
      });

      // Get ministry names for all users who have ministryId
      const ministryIds = [...new Set(users.filter(u => u.ministryId).map(u => u.ministryId))];
      console.log('[getAllMinistrySubmissions] Fetching ministries for IDs:', ministryIds);
      
      // Try to find ministries by ID (UUID) first
      let ministries = ministryIds.length > 0 
        ? await this.ministryRepository.find({
            where: { id: In(ministryIds) },
          })
        : [];
      
      // If some ministries not found by UUID, try by name
      const foundIds = new Set(ministries.map(m => m.id));
      const notFoundIds = ministryIds.filter(id => !foundIds.has(id));
      
      if (notFoundIds.length > 0) {
        console.log('[getAllMinistrySubmissions] Some ministries not found by UUID, trying by name:', notFoundIds);
        const ministriesByName = await this.ministryRepository.find({
          where: { name: In(notFoundIds) },
        });
        ministries = [...ministries, ...ministriesByName];
      }
      
      const ministryMap = new Map<string, string>();
      ministries.forEach(ministry => {
        ministryMap.set(ministry.id, ministry.name);
        // Also map by name in case ministryId is stored as name
        ministryMap.set(ministry.name, ministry.name);
      });
      
      console.log('[getAllMinistrySubmissions] Ministry map created with', ministryMap.size, 'entries');

      // Get all indicator details
      const indicatorIds = submissionIndicators.map((si) => si.indicatorId);
      const indicators = await this.indicatorDetailRepository.find({
        where: { id: In(indicatorIds) },
        order: { sequence: 'ASC', sNo: 'ASC' },
      });

      // Get subsections and input fields for indicators
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { indicatorId: In(indicatorIds), status: true },
        order: { sequence: 'ASC', name: 'ASC' },
      });

      const indicatorInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(indicatorIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      const subsectionIds = subsections.map((sub) => sub.id);
      const subsectionInputFields = await this.inputFieldRepository.find({
        where: { sectionId: In(subsectionIds) },
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Get all submission data
      const submissionIndicatorIds = submissionIndicators.map((si) => si.id);
      const allSubmissionData = await this.ministrySubmissionDataRepository.find({
        where: { submissionIndicatorId: In(submissionIndicatorIds) },
      });

      // Use the existing getSubmissionDetailsWithData structure but group by user
      // First, get all unique users who have submitted indicators
      const userIndicatorMap = new Map<string, string[]>(); // userId -> submissionIndicatorIds
      
      submissionIndicators.forEach((submissionIndicator) => {
        // Use assignedTo as the primary user identifier (this is the user who submitted)
        const userId = submissionIndicator.assignedTo || submissionIndicator.ministryUser;
        if (!userId) return;

        if (!userIndicatorMap.has(userId)) {
          userIndicatorMap.set(userId, []);
        }
        userIndicatorMap.get(userId)!.push(submissionIndicator.id);
      });

      // For each user, get their indicators using the existing structure
      const usersWithIndicators = await Promise.all(
        Array.from(userIndicatorMap.entries()).map(async ([userId, submissionIndicatorIds]) => {
          // Get submission indicators for this user
          const userSubmissionIndicators = submissionIndicators.filter((si) => 
            submissionIndicatorIds.includes(si.id)
          );

          // Build the indicator structure similar to getSubmissionDetailsWithData
          // Group by category
          const categoryMap = new Map<string, any[]>();

          userSubmissionIndicators.forEach((submissionIndicator) => {
            const indicator = indicators.find((ind) => ind.id === submissionIndicator.indicatorId);
            if (!indicator) return;

            const categoryName = indicator.category || 'General';
            if (!categoryMap.has(categoryName)) {
              categoryMap.set(categoryName, []);
            }

            // Get subsections for this indicator
            const indicatorSubsections = subsections.filter((sub) => sub.indicatorId === indicator.id);
            
            // Get input fields for this indicator
            const indicatorFields = indicatorInputFields.filter((field) => field.sectionId === indicator.id);
            
            // Get submission data for this indicator
            const indicatorSubmissionData = allSubmissionData.filter(
              (data) => data.submissionIndicatorId === submissionIndicator.id
            );
            const submissionDataMap = new Map<string, MinistrySubmissionData>();
            indicatorSubmissionData.forEach((data) => {
              submissionDataMap.set(data.inputFieldId, data);
            });

            // Build section structure
            const sectionData: any = {
              sNo: indicator.sNo,
              sequence: indicator.sequence,
              submissionIndicatorId: submissionIndicator.id,
              status: submissionIndicator.status,
              inputs: indicatorFields.map((field) => ({
                ...field,
                submittedData: submissionDataMap.get(field.id) || null,
              })),
              subsection: indicatorSubsections.map((subsection) => {
                const subsectionFields = subsectionInputFields.filter((field) => field.sectionId === subsection.id);
                
                // Get subsection submission data and group by createdAt (within 100ms) to reconstruct rows
                const subsectionData = indicatorSubmissionData.filter((data) => {
                  const field = subsectionFields.find((f) => f.id === data.inputFieldId);
                  return field !== undefined;
                });

                // Group subsection data by createdAt proximity (within 100ms) to form rows
                const rows: any[] = [];
                const processedTimestamps = new Set<string>();

                subsectionData.forEach((data) => {
                  const timestamp = data.createdAt.getTime();
                  const timestampKey = `${Math.floor(timestamp / 100)}`; // Group by 100ms

                  if (!processedTimestamps.has(timestampKey)) {
                    processedTimestamps.add(timestampKey);
                    const rowData: any = {};
                    subsectionFields.forEach((field) => {
                      const fieldData = subsectionData.find(
                        (d) => d.inputFieldId === field.id && 
                               Math.floor(d.createdAt.getTime() / 100) === Math.floor(timestamp / 100)
                      );
                      if (fieldData) {
                        // Extract value based on data type
                        let value: any = null;
                        if (field.dataType === 'number') {
                          value = fieldData.valueNumber;
                        } else if (field.dataType === 'file') {
                          value = fieldData.valueJson;
                        } else {
                          if (fieldData.valueText !== null) value = fieldData.valueText;
                          else if (fieldData.valueNumber !== null) value = fieldData.valueNumber;
                          else if (fieldData.valueDate !== null) value = fieldData.valueDate;
                          else if (fieldData.valueJson !== null) value = fieldData.valueJson;
                        }
                        rowData[field.id] = value;
                      }
                    });
                    if (Object.keys(rowData).length > 0) {
                      rows.push(rowData);
                    }
                  }
                });

                return {
                  [subsection.name]: {
                    inputs: subsectionFields,
                    submittedItems: rows,
                  },
                };
              }),
            };

            categoryMap.get(categoryName)!.push({
              [indicator.name]: sectionData,
            });
          });

          // Convert category map to array format
          const categoryArray = Array.from(categoryMap.entries()).map(([categoryName, sections]) => ({
            [categoryName]: sections,
          }));

          return {
            userId: userId,
            indicators: categoryArray,
          };
        })
      );

      // Add user details to each user's indicators
      const usersWithIndicatorsAndDetails = await Promise.all(
        usersWithIndicators.map(async (userData) => {
          const user = userMap.get(userData.userId);
          let ministryName: string | null = null;
          if (user?.ministryId) {
            // Try to get from map by ID first
            ministryName = ministryMap.get(user.ministryId) || null;
            
            // If not found in map, try to fetch directly
            if (!ministryName) {
              console.log('[getAllMinistrySubmissions] Ministry not in map, fetching directly for:', user.ministryId);
              let ministry = await this.ministryRepository.findOne({
                where: { id: user.ministryId },
              });
              
              if (!ministry) {
                ministry = await this.ministryRepository.findOne({
                  where: { name: user.ministryId },
                });
              }
              
              // Try case-insensitive search
              if (!ministry) {
                const allMinistries = await this.ministryRepository.find();
                ministry = allMinistries.find(m => 
                  m.name.toLowerCase() === user.ministryId.toLowerCase() ||
                  m.id.toLowerCase() === user.ministryId.toLowerCase()
                ) || null;
              }
              
              if (ministry) {
                ministryName = ministry.name;
                // Add to map for future lookups
                ministryMap.set(ministry.id, ministry.name);
                ministryMap.set(ministry.name, ministry.name);
              } else {
                // Fallback: If ministryId looks like a name (not UUID format), use it as the name
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.ministryId);
                if (!isUUID && user.ministryId) {
                  console.log('[getAllMinistrySubmissions] Using ministryId as name (not a UUID):', user.ministryId);
                  // Capitalize first letter of each word
                  ministryName = user.ministryId
                    .split(/[\s._-]+/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                }
              }
            }
          }
          return {
            userId: userData.userId,
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              ministryId: user.ministryId,
              ministryName: ministryName,
            } : null,
            indicators: userData.indicators || [],
          };
        })
      );

      return {
        status: true,
        data: {
          id: submission.id,
          submissionId: submission.submissionId,
          userId: submission.userId,
          formId: submission.formId,
          status: submission.status,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
          users: usersWithIndicatorsAndDetails,
          totalIndicators: submissionIndicators.length,
          submittedIndicators: submissionIndicators.filter((si) => si.status !== null).length,
        },
        message: 'Retrieved ministry submission with all indicators successfully',
      };
    } catch (error) {
      console.error('[getAllMinistrySubmissions] Error:', error);
      throw new BadRequestException(
        error.message || 'Failed to retrieve all ministry submissions',
      );
    }
  }

  /**
   * Get submissions for the current logged-in user
   * Returns all submissions where the user has submitted indicators
   */
  async getSubmissionsForCurrentUser(userId: string): Promise<{
    status: boolean;
    data: any[];
    message: string;
  }> {
    try {
      // Get all submission indicators where this user has submitted (assignedTo or ministryUser = userId)
      const userSubmissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: [
          { assignedTo: userId },
          { ministryUser: userId },
        ],
      });

      if (userSubmissionIndicators.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No submissions found for this user',
        };
      }

      // Get unique submission IDs
      const submissionUuids = [...new Set(userSubmissionIndicators.map((si) => si.submissionId))];
      
      // Get all submissions
      const submissions = await this.ministrySubmissionRepository.find({
        where: { id: In(submissionUuids) },
        order: { updatedAt: 'DESC' },
      });

      if (submissions.length === 0) {
        return {
          status: true,
          data: [],
          message: 'No submissions found for this user',
        };
      }

      // Get user details
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      // Query ministries table explicitly to get ministry name using ministryId
      let ministryName: string | null = null;
      if (user?.ministryId) {
        console.log('[getSubmissionsForCurrentUser] Querying ministries table for ministryId:', user.ministryId);
        
        // Query 1: Query ministries table by ID (UUID) - SELECT * FROM ministries WHERE id = :ministryId
        let ministry = await this.ministryRepository.findOne({
          where: { id: user.ministryId },
        });
        
        // Query 2: If not found by UUID, query ministries table by name - SELECT * FROM ministries WHERE name = :ministryId
        if (!ministry) {
          console.log('[getSubmissionsForCurrentUser] Ministry not found by UUID in ministries table, querying by name...');
          ministry = await this.ministryRepository.findOne({
            where: { name: user.ministryId },
          });
        }
        
        // Query 3: If still not found, query all ministries and do case-insensitive match
        if (!ministry) {
          console.log('[getSubmissionsForCurrentUser] Querying all ministries from ministries table for case-insensitive match...');
          const allMinistries = await this.ministryRepository.find();
          ministry = allMinistries.find(m => 
            m.name.toLowerCase() === user.ministryId.toLowerCase() ||
            m.id.toLowerCase() === user.ministryId.toLowerCase()
          ) || null;
        }
        
        if (ministry) {
          // Successfully retrieved ministry name from ministries table
          ministryName = ministry.name;
          console.log('[getSubmissionsForCurrentUser] ✅ Successfully queried ministries table - Found ministry name:', ministryName, 'from ministry ID:', ministry.id);
        } else {
          console.warn('[getSubmissionsForCurrentUser] ❌ Ministry not found in ministries table for ministryId:', user.ministryId);
          // Log all available ministries from ministries table for debugging
          const allMinistries = await this.ministryRepository.find();
          console.warn('[getSubmissionsForCurrentUser] All ministries in ministries table:', allMinistries.map(m => ({ id: m.id, name: m.name })));
          console.warn('[getSubmissionsForCurrentUser] User ministryId type:', typeof user.ministryId, 'Value:', user.ministryId);
          
          // Fallback: If ministryId looks like a name (not UUID format), use it as the name
          // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with dashes)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.ministryId);
          if (!isUUID && user.ministryId) {
            console.log('[getSubmissionsForCurrentUser] Using ministryId as name (not a UUID):', user.ministryId);
            // Capitalize first letter of each word
            ministryName = user.ministryId
              .split(/[\s._-]+/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
        }
      } else {
        console.log('[getSubmissionsForCurrentUser] User has no ministryId - skipping ministries table query');
      }

      // For each submission, get the indicators submitted by this user
      const submissionsWithData = await Promise.all(
        submissions.map(async (submission) => {
          // Get indicators for this submission that belong to this user
          const userIndicatorsForSubmission = userSubmissionIndicators.filter(
            (si) => si.submissionId === submission.id
          );

          // Get submission details with data for this user
          try {
            const submissionDetails = await this.getSubmissionDetailsWithData(
              userId,
              false // forReview = false to get all data
            );

            // Filter indicators to only show those submitted by this user
            const userIndicators = submissionDetails.data || [];

            return {
              id: submission.id,
              submissionId: submission.submissionId,
              userId: submission.userId,
              formId: submission.formId,
              status: submission.status,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt,
              user: user ? {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                ministryId: user.ministryId,
                ministryName: ministryName,
              } : null,
              indicators: userIndicators,
              totalIndicators: userIndicatorsForSubmission.length,
              submittedIndicators: userIndicatorsForSubmission.filter((si) => si.status !== null).length,
            };
          } catch (error) {
            // If getSubmissionDetailsWithData fails, return basic info
            return {
              id: submission.id,
              submissionId: submission.submissionId,
              userId: submission.userId,
              formId: submission.formId,
              status: submission.status,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt,
              user: user ? {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                ministryId: user.ministryId,
                ministryName: ministryName,
              } : null,
              indicators: [],
              totalIndicators: userIndicatorsForSubmission.length,
              submittedIndicators: userIndicatorsForSubmission.filter((si) => si.status !== null).length,
            };
          }
        })
      );

      // Debug: Log the response structure before returning
      console.log('[getSubmissionsForCurrentUser] ✅ Returning response with', submissionsWithData.length, 'submissions');
      if (submissionsWithData.length > 0) {
        console.log('[getSubmissionsForCurrentUser] First submission user:', submissionsWithData[0]?.user);
        console.log('[getSubmissionsForCurrentUser] First submission ministryName:', submissionsWithData[0]?.user?.ministryName);
      }

      return {
        status: true,
        data: submissionsWithData,
        message: 'Retrieved submissions for current user successfully',
      };
    } catch (error) {
      console.error('[getSubmissionsForCurrentUser] Error:', error);
      throw new BadRequestException(
        error.message || 'Failed to retrieve submissions for current user',
      );
    }
  }
}
