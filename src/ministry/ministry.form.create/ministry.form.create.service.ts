import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndicatorDetail, IndicatorCategory } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField, DataType } from '../entities/input-field.entity';
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
   */
  async getAllActiveIndicators(): Promise<{
    status: boolean;
    data: Record<string, IndicatorDetail[]>;
    message: string;
  }> {
    try {
      const indicators = await this.indicatorDetailRepository.find({
        where: { status: true },
        order: { sequence: 'ASC', sNo: 'ASC' },
      });

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

      return {
        status: true,
        data: groupedIndicators,
        message: `Found ${totalCount} active indicator(s) across ${categoryCount} category/categories`,
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
}
