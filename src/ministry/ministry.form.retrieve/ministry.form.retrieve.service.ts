import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
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
    submissionId?: string;
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
   * If forReview is true, only returns indicators with status not null
   */
  async getSubmissionDetailsWithData(userId: string, forReview?: boolean): Promise<{
    status: boolean;
    data: any[];
    message: string;
    submissionId?: string;
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
      // If forReview is true, filter by status not null
      const whereCondition: any = { submissionId: submissionUuid };
      if (forReview === true) {
        whereCondition.status = Not(IsNull());
      }

      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: whereCondition,
      });

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
            
            // Get all submitted data for this subsection, grouped by field
            const fieldDataMap = new Map<string, MinistrySubmissionData[]>();
            if (submissionIndicatorId) {
              subsectionInputs.forEach((input) => {
                const dataKey = `${submissionIndicatorId}_${input.id}`;
                const submittedData = submissionDataMap.get(dataKey);
                if (submittedData) {
                  if (!fieldDataMap.has(input.id)) {
                    fieldDataMap.set(input.id, []);
                  }
                  fieldDataMap.get(input.id)!.push(submittedData);
                }
              });
            }
            
            // Reconstruct rows: if multiple values exist for any field, we have multiple rows
            // Group by timestamp (values in the same row have similar timestamps)
            const allSubmittedData: MinistrySubmissionData[] = [];
            fieldDataMap.forEach((dataArray) => {
              allSubmittedData.push(...dataArray);
            });
            
            // Sort by createdAt to maintain order
            allSubmittedData.sort((a, b) => 
              a.createdAt.getTime() - b.createdAt.getTime()
            );
            
            // Group into rows: each row should have one value per field
            // If we have N fields and M total values, we have M/N rows (assuming equal distribution)
            const numFields = subsectionInputs.length;
            const numValues = allSubmittedData.length;
            const numRows = numFields > 0 ? Math.floor(numValues / numFields) : 0;
            
            const submittedItems: any[] = [];
            
            if (numRows > 0) {
              // Group by timestamp buckets (values with same/similar timestamp = same row)
              const timestampGroups: Map<number, MinistrySubmissionData[]> = new Map();
              allSubmittedData.forEach((data) => {
                const timestamp = Math.floor(data.createdAt.getTime() / 100); // Group by 100ms
                if (!timestampGroups.has(timestamp)) {
                  timestampGroups.set(timestamp, []);
                }
                timestampGroups.get(timestamp)!.push(data);
              });
              
              // Convert groups to rows
              const sortedGroups = Array.from(timestampGroups.entries())
                .sort((a, b) => a[0] - b[0]);
              
              sortedGroups.forEach(([_, groupData]) => {
                const row: any = {};
                groupData.forEach((data) => {
                  // Extract value based on data type
                  let value: any = null;
                  if (data.valueText !== null) value = data.valueText;
                  else if (data.valueNumber !== null) value = data.valueNumber;
                  else if (data.valueDate !== null) value = data.valueDate;
                  else if (data.valueJson !== null) value = data.valueJson;
                  
                  row[data.inputFieldId] = value;
                });
                
                // Only add row if it has at least one value
                if (Object.keys(row).length > 0) {
                  submittedItems.push(row);
                }
              });
            } else if (numValues > 0) {
              // Single row case: all values belong to one row
              const row: any = {};
              allSubmittedData.forEach((data) => {
                let value: any = null;
                if (data.valueText !== null) value = data.valueText;
                else if (data.valueNumber !== null) value = data.valueNumber;
                else if (data.valueDate !== null) value = data.valueDate;
                else if (data.valueJson !== null) value = data.valueJson;
                
                row[data.inputFieldId] = value;
              });
              submittedItems.push(row);
            }
            
            // Add submittedData to each input (for backward compatibility)
            const inputsWithData = subsectionInputs.map((input) => {
              // Find the first occurrence of this field in submitted data
              const submittedData = allSubmittedData.find(
                (data) => data.inputFieldId === input.id
              );
              
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
}
