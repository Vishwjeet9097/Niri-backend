import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as XLSX from 'xlsx';
import { IndicatorDetail, IndicatorCategory } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField, DataType } from '../entities/input-field.entity';
import { Indicator } from '../../entities/indicator.entity';
import { UserIndicatorScope } from '../../entities/user-indicator-scope.entity';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { CreateSubsectionDto } from './dto/create-subsection.dto';
import { CreateInputFieldDto } from './dto/create-input-field.dto';

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
  ) {}

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
   * If userId is provided, returns only indicators associated with that user
   */
  async getAllActiveIndicators(userId?: string): Promise<{
    status: boolean;
    data: Record<string, IndicatorDetail[]>;
    message: string;
  }> {
    try {
      let indicatorCodes: string[] = [];

      // If userId is provided, get indicator codes associated with that user
      if (userId) {
        const userIndicatorScopes = await this.userIndicatorScopeRepository
          .createQueryBuilder('scope')
          .leftJoinAndSelect('scope.indicator', 'indicator')
          .where('scope.userId = :userId', { userId })
          .getMany();

        // Extract indicator codes from the scopes
        indicatorCodes = userIndicatorScopes
          .map((scope) => scope.indicator?.code)
          .filter((code): code is string => !!code);

        // If no indicators found for the user, return empty result
        if (indicatorCodes.length === 0) {
          return {
            status: true,
            data: {},
            message: `No indicators found for user ${userId}`,
          };
        }
      }

      // Build query for indicator details
      let query = this.indicatorDetailRepository.createQueryBuilder('indicatorDetail')
        .where('indicatorDetail.status = :status', { status: true });

      // If userId is provided, filter by indicator codes (matching sNo with code)
      if (userId && indicatorCodes.length > 0) {
        query = query.andWhere('indicatorDetail.sNo IN (:...codes)', { codes: indicatorCodes });
      }

      const indicators = await query
        .orderBy('indicatorDetail.sequence', 'ASC')
        .addOrderBy('indicatorDetail.sNo', 'ASC')
        .getMany();

      // Group indicators by category
      const groupedIndicators: Record<string, IndicatorDetail[]> = {};
      
      indicators.forEach((indicator) => {
        const category = indicator.category;
        if (!groupedIndicators[category]) {
          groupedIndicators[category] = [];
        }
        groupedIndicators[category].push(indicator);
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
}
