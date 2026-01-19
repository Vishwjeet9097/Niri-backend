import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import * as XLSX from 'xlsx';
import { IndicatorDetail, IndicatorCategory } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField, DataType, UIComponent } from '../entities/input-field.entity';
import { Indicator } from '../../entities/indicator.entity';
import { UserIndicatorScope } from '../../entities/user-indicator-scope.entity';
import { Form } from '../entities/form.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Ministry } from '../../entities/ministry.entity';
import { MinistrySubmissionStatus } from '../entities/ministry-submission.entity';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { CreateSubsectionDto } from './dto/create-subsection.dto';
import { CreateInputFieldDto } from './dto/create-input-field.dto';
import { CreateMinistryFormDto } from './dto/create-ministry-form.dto';
import { AssignIndicatorToNodalDto } from './dto/assign-indicator-to-nodal.dto';
import { ReassignIndicatorDto } from './dto/reassign-indicator.dto';
import { RemoveAssignedIndicatorDto } from './dto/remove-assigned-indicator.dto';

@Injectable()
export class MinistryFormCreateService {
  constructor(
    @InjectRepository(IndicatorDetail)
    private readonly indicatorDetailRepository: Repository<IndicatorDetail>,
    @InjectRepository(IndicatorSubsection)
    private readonly indicatorSubsectionRepository: Repository<IndicatorSubsection>,
    @InjectRepository(InputField)
    private readonly inputFieldRepository: Repository<InputField>,
    @InjectRepository(Indicator)
    private readonly indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private readonly userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(MinistrySubmission)
    private readonly ministrySubmissionRepository: Repository<MinistrySubmission>,
    @InjectRepository(MinistrySubmissionIndicator)
    private readonly ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ministry)
    private readonly ministryRepository: Repository<Ministry>,
  ) { }

  /**
   * Generate custom indicator ID
   * Format: CATEGORY_KEY_SECTION_X.X_randomString
   * Example: INFRA_FINANCING_SECTION_1_wer45672
   */
  private generateIndicatorId(
    category: IndicatorCategory,
    section: string,
  ): string {
    // Get the enum key (e.g., "INFRA_FINANCING" from IndicatorCategory.INFRA_FINANCING)
    const categoryKey = Object.keys(IndicatorCategory).find(
      (key) => IndicatorCategory[key] === category,
    ) || category.replace(/\s+/g, '_').toUpperCase();

    const randomSuffix = Math.random().toString(36).substring(2, 9);
    return `${categoryKey}_SECTION_${section}_${randomSuffix}`;
  }

  /**
   * Create a new indicator
   */
  async createIndicator(createIndicatorDto: CreateIndicatorDto): Promise<{
    status: boolean;
    data: IndicatorDetail;
    message: string;
  }> {
    try {
      // Check if s_no already exists
      const existingIndicator = await this.indicatorDetailRepository.findOne({
        where: { sNo: createIndicatorDto.sNo },
      });

      if (existingIndicator) {
        throw new ConflictException(
          `Indicator with serial number ${createIndicatorDto.sNo} already exists`,
        );
      }

      // Generate ID if not provided
      let indicatorId = createIndicatorDto.id;
      if (!indicatorId) {
        indicatorId = this.generateIndicatorId(
          createIndicatorDto.category,
          createIndicatorDto.sNo,
        );
      } else {
        // Check if provided ID already exists
        const existingById = await this.indicatorDetailRepository.findOne({
          where: { id: indicatorId },
        });
        if (existingById) {
          throw new ConflictException(
            `Indicator with ID ${indicatorId} already exists`,
          );
        }
      }

      // Create indicator entity
      const indicator = this.indicatorDetailRepository.create({
        id: indicatorId,
        name: createIndicatorDto.name,
        category: createIndicatorDto.category,
        sNo: createIndicatorDto.sNo,
        sequence: createIndicatorDto.sequence ?? 0,
        status: createIndicatorDto.status ?? true,
        associatedForm: createIndicatorDto.associatedForm ?? null,
      });

      // Save to database
      const savedIndicator = await this.indicatorDetailRepository.save(indicator);

      return {
        status: true,
        data: savedIndicator,
        message: 'Indicator created successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to create indicator',
      );
    }
  }

  /**
   * Get all indicators with status = true, grouped by category and ordered by sequence
   * If userId is provided, first gets indicator IDs from ministry_submission_indicator table
   */
  async getAllActiveIndicators(userId?: string, forUpdate?: boolean): Promise<{
    status: boolean;
    data: Record<string, (IndicatorDetail & { submissionIndicatorId?: string })[]>;
    message: string;
  }> {
    try {

      console.log('userId', userId, 'forUpdate', forUpdate);
      let indicatorIds: string[] = [];
      let submissionIndicatorMap: Map<string, string> = new Map(); // Map indicatorId -> submissionIndicatorId

      // If userId is provided, get indicator IDs from ministry_submission_indicator table
      if (userId) {
        let submissionIndicators: MinistrySubmissionIndicator[];

        if (forUpdate === true) {
          // Filter by ministryUser equals userId and status is null
          submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
            where: { 
              ministryUser: userId,
              status: IsNull(),
            },
          });
        } else {
          // Previous logic: Filter by assignedTo and get from submissions
          // First, get submissions for this user
          const submissions = await this.ministrySubmissionRepository.find({
            where: { userId: userId },
          });

          if (submissions.length === 0) {
            return {
              status: true,
              data: {},
              message: `No submissions found for user ${userId}`,
            };
          }

          // Get all submission IDs
          const submissionIds: string[] = submissions.map((sub) => sub.id);

          // Get indicator IDs from ministry_submission_indicator table
          // where assignedTo = userId
          submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
            where: { 
              submissionId: In(submissionIds),
              assignedTo: userId,
              status: IsNull(),
            },
          });
        }

        // Extract unique indicator IDs and create mapping
        indicatorIds = [...new Set(submissionIndicators.map((si) => si.indicatorId))];
        
        // Create map of indicatorId -> submissionIndicatorId
        // If multiple submission indicators exist for same indicator, use the first one
        submissionIndicators.forEach((si) => {
          if (!submissionIndicatorMap.has(si.indicatorId)) {
            submissionIndicatorMap.set(si.indicatorId, si.id);
          }
        });

        // If no indicators found, return empty result
        if (indicatorIds.length === 0) {
          const message = forUpdate === true
            ? `No indicators found for user ${userId} with null status in submission indicators`
            : `No indicators found for user ${userId} in submission indicators`;
          return {
            status: true,
            data: {},
            message,
          };
        }
      }

      // Build query for indicator details
      let query = this.indicatorDetailRepository.createQueryBuilder('indicatorDetail')
        .where('indicatorDetail.status = :status', { status: true });

      // If userId is provided, filter by indicator IDs from submission_indicator table
      if (userId && indicatorIds.length > 0) {
        query = query.andWhere('indicatorDetail.id IN (:...ids)', { ids: indicatorIds });
      }

      const indicators = await query
        .orderBy('indicatorDetail.sequence', 'ASC')
        .addOrderBy('indicatorDetail.sNo', 'ASC')
        .getMany();

      // Group indicators by category and add submissionIndicatorId
      const groupedIndicators: Record<string, (IndicatorDetail & { submissionIndicatorId?: string })[]> = {};

      indicators.forEach((indicator) => {
        const category = indicator.category;
        if (!groupedIndicators[category]) {
          groupedIndicators[category] = [];
        }
        
        // Add submissionIndicatorId if userId is provided and mapping exists
        const indicatorWithSubmissionId = {
          ...indicator,
          ...(userId && submissionIndicatorMap.has(indicator.id) && {
            submissionIndicatorId: submissionIndicatorMap.get(indicator.id)
          })
        };
        
        groupedIndicators[category].push(indicatorWithSubmissionId);
      });

      // Sort each category's indicators by sequence
      Object.keys(groupedIndicators).forEach((category) => {
        groupedIndicators[category].sort((a, b) => {
          if (a.sequence !== b.sequence) {
            return a.sequence - b.sequence;
          }
          // If sequence is same, sort by sNo
          return a.sNo.localeCompare(b.sNo, undefined, { numeric: true, sensitivity: 'base' });
        });
      });

      const totalCount = indicators.length;
      const categoryCount = Object.keys(groupedIndicators).length;

      const message = userId
        ? `Found ${totalCount} active indicator(s) for user ${userId} across ${categoryCount} category/categories`
        : `Found ${totalCount} active indicator(s) across ${categoryCount} category/categories`;

      return {
        status: true,
        data: groupedIndicators,
        message,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to fetch indicators',
      );
    }
  }

  /**
   * Generate subsection ID
   * Format: name_indicator_id
   * Example: subsection_name_INFRA_FINANCING_SECTION_1.1_wer45672
   */
  private generateSubsectionId(name: string, indicatorId: string): string {
    const normalizedName = name.replace(/\s+/g, '_').toUpperCase();
    return `${normalizedName}_${indicatorId}`;
  }

  /**
   * Create a new subsection
   */
  async createSubsection(createSubsectionDto: CreateSubsectionDto): Promise<{
    status: boolean;
    data: IndicatorSubsection;
    message: string;
  }> {
    try {
      // Verify that the indicator exists
      const indicator = await this.indicatorDetailRepository.findOne({
        where: { id: createSubsectionDto.indicatorId },
      });

      if (!indicator) {
        throw new NotFoundException(
          `Indicator with ID ${createSubsectionDto.indicatorId} not found`,
        );
      }

      // Generate ID if not provided
      let subsectionId = createSubsectionDto.id;
      if (!subsectionId) {
        subsectionId = this.generateSubsectionId(
          createSubsectionDto.name,
          createSubsectionDto.indicatorId,
        );
      } else {
        // Check if provided ID already exists
        const existingById = await this.indicatorSubsectionRepository.findOne({
          where: { id: subsectionId },
        });
        if (existingById) {
          throw new ConflictException(
            `Subsection with ID ${subsectionId} already exists`,
          );
        }
      }

      // Create subsection entity
      const subsection = this.indicatorSubsectionRepository.create({
        id: subsectionId,
        name: createSubsectionDto.name,
        indicatorId: createSubsectionDto.indicatorId,
        sequence: createSubsectionDto.sequence ?? 0,
        status: createSubsectionDto.status ?? true,
      });

      // Save to database
      const savedSubsection = await this.indicatorSubsectionRepository.save(subsection);

      return {
        status: true,
        data: savedSubsection,
        message: 'Subsection created successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to create subsection',
      );
    }
  }

  /**
   * Get all subsections with status = true, grouped by indicator and ordered by sequence
   */
  async getAllActiveSubsections(): Promise<{
    status: boolean;
    data: Record<string, IndicatorSubsection[]>;
    message: string;
  }> {
    try {
      const subsections = await this.indicatorSubsectionRepository.find({
        where: { status: true },
        order: { sequence: 'ASC', name: 'ASC' },
      });

      // Group subsections by indicator_id
      const groupedSubsections: Record<string, IndicatorSubsection[]> = {};

      subsections.forEach((subsection) => {
        const indicatorId = subsection.indicatorId;
        if (!groupedSubsections[indicatorId]) {
          groupedSubsections[indicatorId] = [];
        }
        groupedSubsections[indicatorId].push(subsection);
      });

      // Sort each indicator's subsections by sequence
      Object.keys(groupedSubsections).forEach((indicatorId) => {
        groupedSubsections[indicatorId].sort((a, b) => {
          if (a.sequence !== b.sequence) {
            return a.sequence - b.sequence;
          }
          // If sequence is same, sort by name
          return a.name.localeCompare(b.name);
        });
      });

      const totalCount = subsections.length;
      const indicatorCount = Object.keys(groupedSubsections).length;

      return {
        status: true,
        data: groupedSubsections,
        message: `Found ${totalCount} active subsection(s) across ${indicatorCount} indicator(s)`,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to fetch subsections',
      );
    }
  }

  /**
   * Create a new input field
   */
  async createInputField(createInputFieldDto: CreateInputFieldDto): Promise<{
    status: boolean;
    data: InputField;
    message: string;
  }> {
    try {
      // Verify that the section (subsection or indicator) exists
      const subsection = await this.indicatorSubsectionRepository.findOne({
        where: { id: createInputFieldDto.sectionId },
      });

      const indicator = await this.indicatorDetailRepository.findOne({
        where: { id: createInputFieldDto.sectionId },
      });

      if (!subsection && !indicator) {
        throw new NotFoundException(
          `Section with ID ${createInputFieldDto.sectionId} not found (neither as subsection nor indicator)`,
        );
      }

      // Create input field entity
      const inputField = this.inputFieldRepository.create({
        sectionId: createInputFieldDto.sectionId,
        label: createInputFieldDto.label,
        dataType: createInputFieldDto.dataType,
        uiComponent: createInputFieldDto.uiComponent,
        validationRules: createInputFieldDto.validationRules ?? null,
        sequence: createInputFieldDto.sequence ?? 0,
      });

      // Save to database
      const savedInputField = await this.inputFieldRepository.save(inputField);

      return {
        status: true,
        data: savedInputField,
        message: 'Input field created successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to create input field',
      );
    }
  }

  /**
   * Get all input fields, grouped by section and ordered by sequence
   */
  async getAllInputFields(): Promise<{
    status: boolean;
    data: Record<string, InputField[]>;
    message: string;
  }> {
    try {
      const inputFields = await this.inputFieldRepository.find({
        order: { sequence: 'ASC', label: 'ASC' },
      });

      // Group input fields by section_id
      const groupedInputFields: Record<string, InputField[]> = {};

      inputFields.forEach((inputField) => {
        const sectionId = inputField.sectionId;
        if (!groupedInputFields[sectionId]) {
          groupedInputFields[sectionId] = [];
        }
        groupedInputFields[sectionId].push(inputField);
      });

      // Sort each section's input fields by sequence
      Object.keys(groupedInputFields).forEach((sectionId) => {
        groupedInputFields[sectionId].sort((a, b) => {
          if (a.sequence !== b.sequence) {
            return a.sequence - b.sequence;
          }
          // If sequence is same, sort by label
          return a.label.localeCompare(b.label);
        });
      });

      const totalCount = inputFields.length;
      const sectionCount = Object.keys(groupedInputFields).length;

      return {
        status: true,
        data: groupedInputFields,
        message: `Found ${totalCount} input field(s) across ${sectionCount} section(s)`,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to fetch input fields',
      );
    }
  }

  /**
   * Upload and process Excel file to create indicators in bulk
   */
  async uploadExcelAndCreateIndicators(file: Express.Multer.File): Promise<{
    status: boolean;
    data: {
      total: number;
      created: number;
      skipped: number;
      errors: Array<{ row: number; error: string }>;
      createdIndicators: IndicatorDetail[];
    };
    message: string;
  }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Parse as JSON - first row is header
      const data = XLSX.utils.sheet_to_json(worksheet) as Array<{
        'S.no': string | number;
        'Name': string;
        'Category': string;
        'Sequence': string | number;
      }>;

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty or has no data rows');
      }

      const createdIndicators: IndicatorDetail[] = [];
      const errors: Array<{ row: number; error: string }> = [];
      let created = 0;
      let skipped = 0;

      // Helper function to map category string to enum
      const mapCategoryToEnum = (categoryStr: string): IndicatorCategory | null => {
        const normalized = categoryStr.trim();
        const categoryMap: Record<string, IndicatorCategory> = {
          'Infra Financing': IndicatorCategory.INFRA_FINANCING,
          'Infra Enablers': IndicatorCategory.INFRA_ENABLERS,
          'Infra Development': IndicatorCategory.INFRA_DEVELOPMENT,
          'PPP Development': IndicatorCategory.PPP_DEVELOPMENT,
        };
        return categoryMap[normalized] || null;
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 because Excel rows start at 1 and first row is header

        try {
          // Validate required fields
          if (!row['S.no'] || !row['Name'] || !row['Category']) {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields: S.no, Name, or Category',
            });
            skipped++;
            continue;
          }

          // Convert sNo to string
          const sNo = String(row['S.no']).trim();
          const name = String(row['Name']).trim();
          const categoryStr = String(row['Category']).trim();
          const sequence = row['Sequence'] ? Number(row['Sequence']) : 0;

          // Map category to enum
          const category = mapCategoryToEnum(categoryStr);
          if (!category) {
            errors.push({
              row: rowNumber,
              error: `Invalid category: ${categoryStr}. Must be one of: Infra Financing, Infra Enablers, Infra Development, PPP Development`,
            });
            skipped++;
            continue;
          }

          // Check if sNo already exists
          const existingIndicator = await this.indicatorDetailRepository.findOne({
            where: { sNo },
          });

          if (existingIndicator) {
            errors.push({
              row: rowNumber,
              error: `Indicator with serial number ${sNo} already exists`,
            });
            skipped++;
            continue;
          }

          // Generate ID
          const indicatorId = this.generateIndicatorId(category, sNo);

          // Check if ID already exists (unlikely but possible)
          const existingById = await this.indicatorDetailRepository.findOne({
            where: { id: indicatorId },
          });

          if (existingById) {
            // Regenerate with different random suffix
            const categoryKey = Object.keys(IndicatorCategory).find(
              (key) => IndicatorCategory[key] === category,
            ) || category.replace(/\s+/g, '_').toUpperCase();
            const randomSuffix = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
            const newIndicatorId = `${categoryKey}_SECTION_${sNo}_${randomSuffix}`;

            // Create indicator
            const indicator = this.indicatorDetailRepository.create({
              id: newIndicatorId,
              name,
              category,
              sNo,
              sequence,
              status: true,
              associatedForm: null,
            });

            const savedIndicator = await this.indicatorDetailRepository.save(indicator);
            createdIndicators.push(savedIndicator);
            created++;
          } else {
            // Create indicator
            const indicator = this.indicatorDetailRepository.create({
              id: indicatorId,
              name,
              category,
              sNo,
              sequence,
              status: true,
              associatedForm: null,
            });

            const savedIndicator = await this.indicatorDetailRepository.save(indicator);
            createdIndicators.push(savedIndicator);
            created++;
          }
        } catch (error) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error processing row',
          });
          skipped++;
        }
      }

      return {
        status: true,
        data: {
          total: data.length,
          created,
          skipped,
          errors,
          createdIndicators,
        },
        message: `Processed ${data.length} row(s): ${created} created, ${skipped} skipped`,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to process Excel file',
      );
    }
  }

  /**
   * Upload and process Excel file to create subsections in bulk
   * Excel format: Name, s.No
   * Finds indicator by sNo and creates subsection with that indicator ID
   */
  async uploadExcelAndCreateSubsections(file: Express.Multer.File): Promise<{
    status: boolean;
    data: {
      total: number;
      created: number;
      skipped: number;
      errors: Array<{ row: number; error: string }>;
      createdSubsections: IndicatorSubsection[];
    };
    message: string;
  }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Parse as raw data to handle header variations
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      // Find header row (first row with data)
      const headerRow = rawData[0];
      if (!headerRow || headerRow.length === 0) {
        throw new BadRequestException('Could not find header row in Excel file');
      }

      // Normalize headers and find column indices
      const headers = headerRow.map((h: any) => String(h || '').trim());

      // Helper function to find column index case-insensitively
      const findColumnIndex = (searchTerms: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i].toLowerCase();
          for (const term of searchTerms) {
            if (header === term.toLowerCase() || header.includes(term.toLowerCase())) {
              return i;
            }
          }
        }
        return -1;
      };

      const nameColIndex = findColumnIndex(['name']);
      const sNoColIndex = findColumnIndex(['s.no', 'sno', 's_no', 'serial', 'serial no', 'serial number']);

      if (nameColIndex === -1 || sNoColIndex === -1) {
        throw new BadRequestException(
          `Could not find required columns. Found columns: ${headers.join(', ')}. ` +
          `Looking for: Name and s.No (or similar)`
        );
      }

      // Parse data rows
      const data = rawData.slice(1).map((row, index) => ({
        name: row[nameColIndex],
        sNo: row[sNoColIndex],
        rowNumber: index + 2, // +2 because Excel rows start at 1 and first row is header
      })).filter(row => row.name !== undefined && row.sNo !== undefined);

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file has no data rows');
      }

      const createdSubsections: IndicatorSubsection[] = [];
      const errors: Array<{ row: number; error: string }> = [];
      let created = 0;
      let skipped = 0;

      // Track sequence per indicator
      const indicatorSequenceMap: Record<string, number> = {};

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = row.rowNumber;

        try {
          // Validate required fields
          if (!row.name || row.name === '' || !row.sNo || row.sNo === '') {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields: Name or s.No is empty',
            });
            skipped++;
            continue;
          }

          const name = String(row.name).trim();
          const sNo = String(row.sNo).trim();

          if (!name || !sNo) {
            errors.push({
              row: rowNumber,
              error: 'Name or s.No cannot be empty',
            });
            skipped++;
            continue;
          }

          // Find indicator by sNo
          const indicator = await this.indicatorDetailRepository.findOne({
            where: { sNo },
          });

          if (!indicator) {
            errors.push({
              row: rowNumber,
              error: `Indicator with serial number ${sNo} not found`,
            });
            skipped++;
            continue;
          }

          // Get or initialize sequence for this indicator
          if (!indicatorSequenceMap[indicator.id]) {
            // Get the highest sequence for this indicator
            const existingSubsections = await this.indicatorSubsectionRepository.find({
              where: { indicatorId: indicator.id },
              order: { sequence: 'DESC' },
              take: 1,
            });
            indicatorSequenceMap[indicator.id] = existingSubsections.length > 0
              ? existingSubsections[0].sequence + 1
              : 1;
          } else {
            indicatorSequenceMap[indicator.id]++;
          }

          const sequence = indicatorSequenceMap[indicator.id];

          // Generate subsection ID
          const subsectionId = this.generateSubsectionId(name, indicator.id);

          // Check if subsection with this ID already exists
          const existingSubsection = await this.indicatorSubsectionRepository.findOne({
            where: { id: subsectionId },
          });

          if (existingSubsection) {
            errors.push({
              row: rowNumber,
              error: `Subsection with name "${name}" for indicator ${sNo} already exists`,
            });
            skipped++;
            continue;
          }

          // Create subsection
          const subsection = this.indicatorSubsectionRepository.create({
            id: subsectionId,
            name,
            indicatorId: indicator.id,
            sequence,
            status: true,
          });

          const savedSubsection = await this.indicatorSubsectionRepository.save(subsection);
          createdSubsections.push(savedSubsection);
          created++;
        } catch (error) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error processing row',
          });
          skipped++;
        }
      }

      return {
        status: true,
        data: {
          total: data.length,
          created,
          skipped,
          errors,
          createdSubsections,
        },
        message: `Processed ${data.length} row(s): ${created} created, ${skipped} skipped`,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to process Excel file',
      );
    }
  }

  /**
   * Create ministry form based on user role
   * For MOSPI_REVIEWER: Create/update form with ministryId and add userId to reviewer
   * For MINISTRY_APPROVER: Create/update form with ministryId, add userId to ministryUser, create submission, and insert submission indicators
   */
  async createMinistryForm(createMinistryFormDto: CreateMinistryFormDto): Promise<{
    status: boolean;
    data: any;
    message: string;
  }> {
    try {
      const { userId, userRole, ministryId } = createMinistryFormDto;

      // Validate user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate ministry exists
      const ministry = await this.ministryRepository.findOne({ where: { id: ministryId } });
      if (!ministry) {
        throw new NotFoundException(`Ministry with ID ${ministryId} not found`);
      }

      // Validate user role
      if (userRole !== UserRole.MOSPI_REVIEWER && userRole !== UserRole.MINISTRY_APPROVER) {
        throw new BadRequestException(
          `Invalid user role. Expected MOSPI_REVIEWER or MINISTRY_APPROVER, got ${userRole}`
        );
      }

      const currentYear = new Date().getFullYear();

      // Check if form already exists with this ministryId
      let existingForm = await this.formRepository.findOne({
        where: { ministry: ministryId },
      });

      if (userRole === UserRole.MOSPI_REVIEWER) {
        if (existingForm) {
          // Update existing form - only update reviewer
          existingForm.reviewer = userId;
          const savedForm = await this.formRepository.save(existingForm);

          return {
            status: true,
            data: {
              form: savedForm,
              role: 'MOSPI_REVIEWER',
              action: 'updated',
            },
            message: 'Form reviewer updated successfully for MOSPI Reviewer',
          };
        } else {
          // Create new form with ministryId and add userId to reviewer
          const form = this.formRepository.create({
            year: currentYear,
            ministry: ministryId,
            reviewer: userId,
          });

          const savedForm = await this.formRepository.save(form);

          return {
            status: true,
            data: {
              form: savedForm,
              role: 'MOSPI_REVIEWER',
              action: 'created',
            },
            message: 'Form created successfully for MOSPI Reviewer',
          };
        }
      } else if (userRole === UserRole.MINISTRY_APPROVER) {
        const formExisted = !!existingForm;

        if (existingForm) {
          // Check if ministry_user already exists and is different from current userId
          if (existingForm.ministryUser && existingForm.ministryUser !== userId) {
            throw new ConflictException('User already exists as ministry user for this form');
          }

          // Update existing form - update ministryUser (only if it doesn't exist or is the same user)
          existingForm.ministryUser = userId;
          const savedForm = await this.formRepository.save(existingForm);
          existingForm = savedForm;
        } else {
          // Create new form with ministryId and ministryUser
          const form = this.formRepository.create({
            year: currentYear,
            ministry: ministryId,
            ministryUser: userId,
          });

          const savedForm = await this.formRepository.save(form);
          existingForm = savedForm;
        }

        // Update user's ministryId
        await this.userRepository.update(userId, { ministryId: ministryId });

        // Generate submission ID: SUB-{year}-{randomNum}
        const randomNum = Math.floor(Math.random() * 1000000);
        const submissionId = `SUB-${currentYear}-${randomNum}`;

        // Create submission with formId and userId
        const submission = this.ministrySubmissionRepository.create({
          submissionId,
          formId: existingForm.id,
          userId: userId,
          //status: SubmissionStatus.DRAFT,
          status: null,
        });

        const savedSubmission = await this.ministrySubmissionRepository.save(submission);

        // Get all active indicator details
        const activeIndicators = await this.indicatorDetailRepository.find({
          where: { status: true },
        });

        // Insert submission indicators for all active indicators with userId and ministryUser
        const submissionIndicators = activeIndicators.map((indicator) =>
          this.ministrySubmissionIndicatorRepository.create({
            submissionId: savedSubmission.id,
            indicatorId: indicator.id,
            status: null, // Status is null initially
            ministryUser: userId,
            assignedTo: userId,
          })
        );

        await this.ministrySubmissionIndicatorRepository.save(submissionIndicators);

        return {
          status: true,
          data: {
            form: existingForm,
            submission: savedSubmission,
            indicatorsCount: activeIndicators.length,
            role: 'MINISTRY_APPROVER',
            action: formExisted ? 'updated' : 'created',
          },
          message: `Form ${formExisted ? 'updated' : 'created'} and submission created successfully for Ministry Approver. ${activeIndicators.length} indicators added.`,
        };
      }

      throw new BadRequestException('Invalid user role');
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to create ministry form',
      );
    }
  }


  /**
  * Assign indicators to nodal officer
  * Gets formId from ministryUserId, creates submission, and updates submission indicators
  */
  async assignIndicatorToNodal(assignIndicatorToNodalDto: AssignIndicatorToNodalDto): Promise<{
    status: boolean;
    data: any;
    message: string;
  }> {
    try {
      const { nodalUserId, ministryUserId, indicatorsId } = assignIndicatorToNodalDto;

      // Validate nodal user exists
      const nodalUser = await this.userRepository.findOne({ where: { id: nodalUserId } });
      if (!nodalUser) {
        throw new NotFoundException(`Nodal user with ID ${nodalUserId} not found`);
      }

      // Validate ministry user exists
      const ministryUser = await this.userRepository.findOne({ where: { id: ministryUserId } });
      if (!ministryUser) {
        throw new NotFoundException(`Ministry user with ID ${ministryUserId} not found`);
      }

      // Get formId from ministryUserId (find form where ministryUser = ministryUserId)
      const form = await this.formRepository.findOne({
        where: { ministryUser: ministryUserId },
      });

      if (!form) {
        throw new NotFoundException(`Form not found for ministry user ${ministryUserId}`);
      }

      // Get the ministry user's submission to find existing submission indicators
      const ministrySubmission = await this.ministrySubmissionRepository.findOne({
        where: { formId: form.id, userId: ministryUserId },
      });

      if (!ministrySubmission) {
        throw new NotFoundException(`Submission not found for ministry user ${ministryUserId}`);
      }

      // Check if all indicators in the array are assigned to ministry user
      const existingIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: {
          submissionId: ministrySubmission.id,
          indicatorId: In(indicatorsId),
          assignedTo: ministryUserId,
        },
      });

      // Check if all requested indicators are found and assigned to ministry user
      const foundIndicatorIds = existingIndicators.map((ind) => ind.indicatorId);
      const missingIndicators = indicatorsId.filter((id) => !foundIndicatorIds.includes(id));

      if (missingIndicators.length > 0) {
        throw new BadRequestException(
          `Some indicators are not assigned to ministry user: ${missingIndicators.join(', ')}`
        );
      }

      if (existingIndicators.length !== indicatorsId.length) {
        throw new BadRequestException(
          `Not all indicators are assigned to ministry user. Found ${existingIndicators.length}, expected ${indicatorsId.length}`
        );
      }

      // Generate submission ID: SUB-{year}-{randomNum}
      const currentYear = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 1000000);
      const submissionId = `SUB-${currentYear}-${randomNum}`;

      // Create new submission with formId and nodalUserId
      const newSubmission = this.ministrySubmissionRepository.create({
        submissionId,
        formId: form.id,
        userId: nodalUserId,
        status: MinistrySubmissionStatus.DRAFT,
      });

      const savedSubmission = await this.ministrySubmissionRepository.save(newSubmission);

      // Update submission indicators: change assigned_to to nodalUserId and submissionId to new submission id
      await this.ministrySubmissionIndicatorRepository.update(
        {
          submissionId: ministrySubmission.id,
          indicatorId: In(indicatorsId),
          assignedTo: ministryUserId,
        },
        {
          assignedTo: nodalUserId,
          submissionId: savedSubmission.id,
        }
      );

      return {
        status: true,
        data: {
          submission: savedSubmission,
          indicatorsCount: indicatorsId.length,
          updatedIndicators: indicatorsId,
        },
        message: `Successfully assigned ${indicatorsId.length} indicator(s) to nodal officer`,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to assign indicators to nodal officer',
      );
    }
  }

  /**
   * Reassign indicators from ministry user to another user
   * Checks if ministryUser matches and status is null, then updates submissionId and assignedTo
   */
  async reassignIndicator(reassignIndicatorDto: ReassignIndicatorDto): Promise<{
    status: boolean;
    data: any;
    message: string;
  }> {
    try {
      const { nodalUserId:userId, ministryUserId, indicatorsId } = reassignIndicatorDto;

      console.log('RECIEVED USER ID', userId);

      // Validate indicatorIds is an array and not empty
      if (!Array.isArray(indicatorsId) || indicatorsId.length === 0) {
        throw new BadRequestException('indicatorIds must be a non-empty array');
      }

      // Validate user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate ministry user exists
      const ministryUser = await this.userRepository.findOne({ where: { id: ministryUserId } });
      if (!ministryUser) {
        throw new NotFoundException(`Ministry user with ID ${ministryUserId} not found`);
      }

      // Check if submission indicators exist with:
      // - ministryUser = ministryUserId
      // - status is null
      // - indicatorId in the provided array
      // Ensure indicatorIds is a valid array before using In()
      const validIndicatorIds = Array.isArray(indicatorsId) ? indicatorsId : [];
      if (validIndicatorIds.length === 0) {
        throw new BadRequestException('indicatorIds must be a non-empty array');
      }

      const existingIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: {
          ministryUser: ministryUserId,
          indicatorId: In(validIndicatorIds),
          status: IsNull(),
        },
      });

      if (existingIndicators.length === 0) {
        throw new NotFoundException(
          `No indicators found for ministry user ${ministryUserId} with null status`
        );
      }

      // Check if all requested indicators are found
      const foundIndicatorIds = existingIndicators.map((ind) => ind.indicatorId);
      const missingIndicators = validIndicatorIds.filter((id) => !foundIndicatorIds.includes(id));

      if (missingIndicators.length > 0) {
        throw new BadRequestException(
          `Some indicators are not found or do not have null status for ministry user: ${missingIndicators.join(', ')}`
        );
      }


      console.log('foundIndicatorIds', foundIndicatorIds);
      
      // Step 1: Get ministry user's submission
      const ministryForm = await this.formRepository.findOne({
        where: { ministryUser: ministryUserId },
      });

      if (!ministryForm) {
        throw new NotFoundException(`Form not found for ministry user ${ministryUserId}`);
      }

      const ministrySubmission = await this.ministrySubmissionRepository.findOne({
        where: { formId: ministryForm.id, userId: ministryUserId },
        order: { createdAt: 'DESC' },
      });

      if (!ministrySubmission) {
        throw new NotFoundException(`Submission not found for ministry user ${ministryUserId}`);
      }

      // Step 2: Find all indicators already assigned to nodal user (userId) with status null
      // and reassign them back to ministry user
      const nodalUserIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: {
          assignedTo: userId,
          status: IsNull(),
        },
      });

      if (nodalUserIndicators.length > 0) {
        // Reassign these indicators back to ministry user
        await this.ministrySubmissionIndicatorRepository.update(
          {
            id: In(nodalUserIndicators.map((ind) => ind.id)),
          },
          {
            assignedTo: ministryUserId,
            submissionId: ministrySubmission.id,
          }
        );
      }

      // Step 3: Get the nodal user's submission (the user we're assigning to)
      let userSubmission = await this.ministrySubmissionRepository.findOne({
        where: { userId: userId },
        order: { createdAt: 'DESC' }, // Get the most recent submission
      });

      // If no submission exists for the user, create one
      if (!userSubmission) {
        // Generate submission ID: SUB-{year}-{randomNum}
        const currentYear = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 1000000);
        const submissionId = `SUB-${currentYear}-${randomNum}`;

        // Create new submission for the user
        userSubmission = this.ministrySubmissionRepository.create({
          submissionId,
          formId: ministryForm.id,
          userId: userId,
          status: MinistrySubmissionStatus.DRAFT,
        });

        userSubmission = await this.ministrySubmissionRepository.save(userSubmission);
      }

      // Step 4: Update the indicators received in array to assign them to nodal user
      // - Update submissionId to user's submission id
      // - Update assignedTo to userId

      console.log('userID before updating', userId);

      await this.ministrySubmissionIndicatorRepository.update(
        {
          id: In(existingIndicators.map((ind) => ind.id)),
        },
        {
          submissionId: userSubmission.id,
          assignedTo: userId,
        }
      );

      return {
        status: true,
        data: {
          submission: userSubmission,
          indicatorsCount: existingIndicators.length,
          updatedIndicators: foundIndicatorIds,
          reassignedToMinistry: nodalUserIndicators.length,
        },
        message: `Successfully reassigned ${nodalUserIndicators.length} indicator(s) back to ministry user and ${existingIndicators.length} indicator(s) to nodal user ${userId}`,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to reassign indicators',
      );
    }
  }

  /**
     * Upload and process Excel file to create input fields in bulk
     * Excel format: Indicator S.no, Field Name, Data Type, UI Component, Subsection Field
     * If Subsection Field = "No": sectionId = indicator.id
     * If Subsection Field = "Yes": sectionId = first active subsection.id for that indicator
     */
  async uploadExcelAndCreateInputFields(file: Express.Multer.File): Promise<{
    status: boolean;
    data: {
      total: number;
      created: number;
      skipped: number;
      errors: Array<{ row: number; error: string }>;
      createdInputFields: InputField[];
    };
    message: string;
  }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Parse as raw data to handle header variations
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      // Find header row (first row with data)
      const headerRow = rawData[0];
      if (!headerRow || headerRow.length === 0) {
        throw new BadRequestException('Could not find header row in Excel file');
      }

      // Normalize headers and find column indices
      const headers = headerRow.map((h: any) => String(h || '').trim());

      // Helper function to find column index case-insensitively
      const findColumnIndex = (searchTerms: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i].toLowerCase();
          for (const term of searchTerms) {
            if (header === term.toLowerCase() || header.includes(term.toLowerCase())) {
              return i;
            }
          }
        }
        return -1;
      };

      const sNoColIndex = findColumnIndex(['indicator s.no', 's.no', 'sno', 's_no', 'serial', 'serial no', 'indicator s no']);
      const fieldNameColIndex = findColumnIndex(['field name', 'fieldname', 'field']);
      const dataTypeColIndex = findColumnIndex(['data type', 'datatype', 'type']);
      const uiComponentColIndex = findColumnIndex(['ui component', 'uicomponent', 'component']);
      const subsectionFieldColIndex = findColumnIndex(['subsection field', 'subsectionfield', 'subsection']);

      if (sNoColIndex === -1 || fieldNameColIndex === -1 || dataTypeColIndex === -1 ||
        uiComponentColIndex === -1 || subsectionFieldColIndex === -1) {
        throw new BadRequestException(
          `Could not find required columns. Found columns: ${headers.join(', ')}. ` +
          `Looking for: Indicator S.no, Field Name, Data Type, UI Component, Subsection Field`
        );
      }

      // Parse data rows
      const data = rawData.slice(1).map((row, index) => ({
        sNo: row[sNoColIndex],
        fieldName: row[fieldNameColIndex],
        dataType: row[dataTypeColIndex],
        uiComponent: row[uiComponentColIndex],
        subsectionField: row[subsectionFieldColIndex],
        rowNumber: index + 2, // +2 because Excel rows start at 1 and first row is header
      })).filter(row => row.sNo !== undefined && row.fieldName !== undefined);

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file has no data rows');
      }

      const createdInputFields: InputField[] = [];
      const errors: Array<{ row: number; error: string }> = [];
      let created = 0;
      let skipped = 0;

      // Track sequence per section
      const sectionSequenceMap: Record<string, number> = {};

      // Helper function to map data type string to DataType enum
      const mapDataType = (dataTypeStr: string): DataType => {
        const normalized = String(dataTypeStr || '').trim().toLowerCase();
        if (normalized.includes('numeric') || normalized.includes('number')) {
          return DataType.NUMBER;
        }
        if (normalized.includes('file')) {
          return DataType.FILE;
        }
        if (normalized.includes('date')) {
          return DataType.DATE;
        }
        return DataType.STRING;
      };

      // Helper function to map UI Component string to UIComponent enum
      const mapUIComponent = (uiComponentStr: string): UIComponent => {
        const normalized = String(uiComponentStr || '').trim().toLowerCase();
        
        // Match exact or partial UI Component strings (order matters - check specific ones first)
        if (normalized.includes('auto-calculated') || normalized.includes('auto calculated')) {
          return UIComponent.AUTO_CALCULATED;
        }
        if (normalized.includes('text area') || normalized.includes('textarea')) {
          return UIComponent.TEXT_AREA;
        }
        if (normalized.includes('checkbox')) {
          return UIComponent.CHECKBOXES;
        }
        if (normalized.includes('file')) {
          return UIComponent.FILE;
        }
        if (normalized.includes('dropdown')) {
          return UIComponent.DROPDOWN;
        }
        if (normalized.includes('input') && normalized.includes('date')) {
          return UIComponent.INPUT_DATE;
        }
        if (normalized.includes('input') && (normalized.includes('number') || normalized.includes('numeric'))) {
          return UIComponent.INPUT_NUMBER;
        }
        if (normalized.includes('input') && normalized.includes('text')) {
          return UIComponent.INPUT_TEXT;
        }
        
        // Default fallback based on common patterns
        if (normalized.includes('date')) {
          return UIComponent.INPUT_DATE;
        }
        if (normalized.includes('number') || normalized.includes('numeric')) {
          return UIComponent.INPUT_NUMBER;
        }
        
        return UIComponent.INPUT_TEXT;
      };

      // Helper function to parse dropdown options from field name
      // Examples: "Asset Type (Core/Non-Core)" -> ["Core", "Non-Core"]
      //           "Type (Option1/Option2/Option3)" -> ["Option1", "Option2", "Option3"]
      const parseDropdownOptions = (fieldName: string): string[] | null => {
        // Look for patterns like (Option1/Option2) or (Option1, Option2)
        const parenthesesMatch = fieldName.match(/\(([^)]+)\)/);
        if (parenthesesMatch) {
          const optionsStr = parenthesesMatch[1];
          // Split by / or , and trim each option
          const options = optionsStr.split(/[\/,]/).map(opt => opt.trim()).filter(opt => opt.length > 0);
          if (options.length > 0) {
            return options;
          }
        }
        return null;
      };

      // Helper function to determine if subsection field
      const isSubsectionField = (value: any): boolean => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'yes' || normalized === 'y' || normalized === 'true' || normalized === '1';
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = row.rowNumber;

        try {
          // Validate required fields
          if (!row.sNo || row.sNo === '' || !row.fieldName || row.fieldName === '') {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields: Indicator S.no or Field Name is empty',
            });
            skipped++;
            continue;
          }

          const sNo = String(row.sNo).trim();
          const originalFieldName = String(row.fieldName).trim();
          const dataTypeStr = String(row.dataType || 'string').trim();
          const uiComponent = String(row.uiComponent || '').trim();
          const isSubsection = isSubsectionField(row.subsectionField);
          
          // Parse dropdown options from original field name before cleaning
          let dropdownOptions: string[] | null = null;
          let fieldName: string;
          if (uiComponent.toLowerCase().includes('dropdown')) {
            dropdownOptions = parseDropdownOptions(originalFieldName);
            // Clean field name: remove options in parentheses for dropdown fields
            // e.g., "Asset Type (Core/Non-Core)" -> "Asset Type"
            fieldName = originalFieldName.replace(/\s*\([^)]+\)\s*$/, '').trim();
          } else {
            fieldName = originalFieldName;
          }

          if (!sNo || !fieldName) {
            errors.push({
              row: rowNumber,
              error: 'Indicator S.no or Field Name cannot be empty',
            });
            skipped++;
            continue;
          }

          // Find indicator by sNo
          const indicator = await this.indicatorDetailRepository.findOne({
            where: { sNo },
          });

          if (!indicator) {
            errors.push({
              row: rowNumber,
              error: `Indicator with serial number ${sNo} not found`,
            });
            skipped++;
            continue;
          }

          let sectionId: string;

          if (isSubsection) {
            // Get first active subsection for this indicator
            const subsection = await this.indicatorSubsectionRepository.findOne({
              where: { indicatorId: indicator.id, status: true },
              order: { sequence: 'ASC' },
            });

            if (!subsection) {
              errors.push({
                row: rowNumber,
                error: `No active subsection found for indicator ${sNo}`,
              });
              skipped++;
              continue;
            }

            sectionId = subsection.id;
          } else {
            // Use indicator id as sectionId
            sectionId = indicator.id;
          }

          // Get or initialize sequence for this section
          if (!sectionSequenceMap[sectionId]) {
            // Get the highest sequence for this section
            const existingInputFields = await this.inputFieldRepository.find({
              where: { sectionId },
              order: { sequence: 'DESC' },
              take: 1,
            });
            sectionSequenceMap[sectionId] = existingInputFields.length > 0
              ? existingInputFields[0].sequence + 1
              : 1;
          } else {
            sectionSequenceMap[sectionId]++;
          }

          const sequence = sectionSequenceMap[sectionId];

          // Map data type and UI component
          const dataType = mapDataType(dataTypeStr);
          const mappedUIComponent = mapUIComponent(uiComponent);

          // Create validation rules based on UI component and data type
          let validationRules: any = null;
          if (dataType === DataType.NUMBER) {
            validationRules = {
              required: true,
            };
          } else if (dataType === DataType.FILE) {
            validationRules = {
              required: false,
            };
          } else if (mappedUIComponent === UIComponent.DROPDOWN) {
            validationRules = {
              required: true,
            };
            // Add options if found (already parsed from original field name)
            if (dropdownOptions && dropdownOptions.length > 0) {
              validationRules.options = dropdownOptions;
            }
          }

          // Check if input field with same label already exists for this section
          const existingInputField = await this.inputFieldRepository.findOne({
            where: { sectionId, label: fieldName },
          });

          if (existingInputField) {
            errors.push({
              row: rowNumber,
              error: `Input field with name "${fieldName}" already exists for this section`,
            });
            skipped++;
            continue;
          }

          // Create input field
          const inputField = this.inputFieldRepository.create({
            sectionId,
            label: fieldName,
            dataType,
            uiComponent: mappedUIComponent,
            validationRules,
            sequence,
          });

          const savedInputField = await this.inputFieldRepository.save(inputField);
          createdInputFields.push(savedInputField);
          created++;
        } catch (error) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error processing row',
          });
          skipped++;
        }
      }

      return {
        status: true,
        data: {
          total: data.length,
          created,
          skipped,
          errors,
          createdInputFields,
        },
        message: `Processed ${data.length} row(s): ${created} created, ${skipped} skipped`,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to process Excel file',
      );
    }
  }

  /**
   * Remove/Update assigned indicator - Update assignedTo field in ministry_submission_indicator table
   */
  async removeAssignedIndicator(
    dto: RemoveAssignedIndicatorDto,
  ): Promise<{
    status: boolean;
    message: string;
    data?: {
      updatedCount: number;
      indicatorsId: string[];
      ministryUserId: string;
    };
  }> {
    try {
      // Step 1: Find all submission indicators where indicatorId is in the provided indicatorsId array
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: {
          indicatorId: In(dto.indicatorsId),
        },
      });

      if (submissionIndicators.length === 0) {
        return {
          status: true,
          message: 'No submission indicators found for the provided indicator IDs',
          data: {
            updatedCount: 0,
            indicatorsId: dto.indicatorsId,
            ministryUserId: dto.ministryUserId,
          },
        };
      }

      // Step 2: Update assignedTo field to ministryUserId for all found submission indicators
      const updateResult = await this.ministrySubmissionIndicatorRepository.update(
        {
          indicatorId: In(dto.indicatorsId),
        },
        {
          assignedTo: dto.ministryUserId,
        },
      );

      return {
        status: true,
        message: `Successfully updated assignedTo for ${updateResult.affected || 0} submission indicator(s)`,
        data: {
          updatedCount: updateResult.affected || 0,
          indicatorsId: dto.indicatorsId,
          ministryUserId: dto.ministryUserId,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to remove/update assigned indicator',
      );
    }
  }
}
