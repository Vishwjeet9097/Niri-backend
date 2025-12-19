import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { UlbMaster, UlbStatus } from '../../entities/ulb-master.entity';
import { CreateUlbDto } from './dto/create-ulb.dto';
import { UpdateUlbDto } from './dto/update-ulb.dto';

@Injectable()
export class UlbService {
  constructor(
    @InjectRepository(UlbMaster)
    private ulbMasterRepository: Repository<UlbMaster>,
  ) {}

  async uploadExcelAndCreateUlbs(file: Express.Multer.File): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Parse as raw data to handle multiple header rows
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      // Find the actual header row (look for row with State_Name, City_Name, ULB Type)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        const rowStr = row.join('|').toLowerCase();
        if (rowStr.includes('state') && rowStr.includes('city') && rowStr.includes('ulb')) {
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        throw new BadRequestException('Could not find header row with State_Name, City_Name, and ULB Type columns');
      }
      
      // Use the found header row and get data after it
      const headers = rawData[headerRowIndex].map((h: any) => h ? String(h).trim() : '');
      const data = rawData.slice(headerRowIndex + 1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
            obj[header] = row[index];
          }
        });
        return obj;
      }).filter(row => Object.keys(row).length > 0);

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty or has no data rows');
      }

      const ulbsToCreate = [];
      const errors = [];
      const duplicates = [];

      // Helper function to find column value case-insensitively
      const findColumnValue = (row: any, possibleNames: string[]): string | undefined => {
        for (const key of Object.keys(row)) {
          const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
          for (const name of possibleNames) {
            const normalizedName = name.toLowerCase().trim().replace(/\s+/g, '_');
            if (normalizedKey === normalizedName || key.trim() === name.trim()) {
              return row[key];
            }
          }
        }
        return undefined;
      };

      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];

        // Extract columns - handle various possible column name formats
        const stateName = findColumnValue(row, [
          'State_Name', 'State Name', 'state_name', 'STATE_NAME', 
          'StateName', 'state name', 'State', 'state'
        ]);
        const cityName = findColumnValue(row, [
          'City_Name', 'City Name', 'city_name', 'CITY_NAME',
          'CityName', 'city name', 'City', 'city', 'ULB Name', 'ULB_Name'
        ]);
        const ulbType = findColumnValue(row, [
          'ULB Type', 'ULB_Type', 'ulb_type', 'ULB TYPE',
          'ULBType', 'ulb type', 'Type', 'type'
        ]);
        const ulbName = findColumnValue(row, [
          'Sub_District_Name', 'Sub District Name', 'sub_district_name', 'SUB_DISTRICT_NAME',
          'SubDistrictName', 'sub district name', 'Sub District', 'sub_district'
        ]);

        if (!stateName || !cityName) {
          errors.push({
            row: i + 2, // +2 because Excel rows start at 1 and first row is header
            error: 'Missing required fields (State_Name or City_Name)',
            data: row,
            availableColumns: Object.keys(row),
          });
          continue;
        }

        ulbsToCreate.push({
          state_name: stateName.trim(),
          city_name: cityName.trim(),
          ulb_name: ulbName ? ulbName.trim() : null,
          ulb_type: ulbType ? ulbType.trim() : 'N/A',
          status: UlbStatus.ACTIVE,
        });
      }

      // Insert valid ULBs
      let created = [];
      if (ulbsToCreate.length > 0) {
        created = await this.ulbMasterRepository.save(ulbsToCreate);
      }

      return {
        success: true,
        totalRows: data.length,
        created: created.length,
        errors: errors.length,
        duplicates: duplicates.length,
        errorDetails: errors,
        duplicateDetails: duplicates,
        message: `Successfully created ${created.length} ULB records`,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error processing Excel file: ${error.message}`,
      );
    }
  }

  async create(createUlbDto: CreateUlbDto): Promise<UlbMaster> {
    const ulb = this.ulbMasterRepository.create(createUlbDto);
    return await this.ulbMasterRepository.save(ulb);
  }

  async findAll(): Promise<UlbMaster[]> {
    return await this.ulbMasterRepository.find({
      select: ['id', 'state_name', 'city_name', 'ulb_name', 'ulb_type', 'status'],
      order: { 
        state_name: 'ASC',
        city_name: 'ASC',
        ulb_type: 'ASC'
      },
    });
  }

  async findOne(id: string): Promise<UlbMaster> {
    const ulb = await this.ulbMasterRepository.findOne({ 
      where: { id },
      select: ['id', 'state_name', 'city_name', 'ulb_name', 'ulb_type', 'status']
    });
    if (!ulb) {
      throw new NotFoundException(`ULB with ID ${id} not found`);
    }
    return ulb;
  }

  async update(id: string, updateUlbDto: UpdateUlbDto): Promise<UlbMaster> {
    const ulb = await this.findOne(id);
    Object.assign(ulb, updateUlbDto);
    return await this.ulbMasterRepository.save(ulb);
  }

  async remove(id: string): Promise<void> {
    const ulb = await this.findOne(id);
    await this.ulbMasterRepository.remove(ulb);
  }

  async findByStatus(status: UlbStatus): Promise<UlbMaster[]> {
    return await this.ulbMasterRepository.find({
      where: { status },
      select: ['id', 'state_name', 'city_name', 'ulb_name', 'ulb_type', 'status'],
      order: { 
        state_name: 'ASC',
        city_name: 'ASC',
        ulb_name: 'ASC'
      },
    });
  }

  async findByStateName(stateName: string): Promise<{ total: number, data: UlbMaster[] }> {
    // Perform case-insensitive search for state_name
    const [data, total] = await this.ulbMasterRepository.findAndCount({
      where: {
        status: UlbStatus.ACTIVE,
      },
      select: ['id', 'state_name', 'city_name', 'ulb_name', 'ulb_type'],
      order: {
        ulb_name: 'ASC',
        city_name: 'ASC',
      },
    });
    // Filter in JS if DB is not configured for ILIKE/LOWER
    const normalizedStateName = stateName.trim().toLowerCase();
    const filteredData = data.filter(
      (ulb) => ulb.state_name && ulb.state_name.trim().toLowerCase() === normalizedStateName
    );
    return { total: filteredData.length, data: filteredData };
  }

  async findByCityName(cityName: string): Promise<{ total: number, data: UlbMaster[] }> {
    const [data, total] = await this.ulbMasterRepository.findAndCount({
      where: { 
        city_name: cityName,
        status: UlbStatus.ACTIVE
      },
      select: ['id', 'state_name', 'city_name', 'ulb_name', 'ulb_type'],
      order: { 
        state_name: 'ASC',
        ulb_name: 'ASC'
      },
    });
    return { total, data };
  }

  async findByUlbName(ulbName: string): Promise<{ total: number, data: UlbMaster[] }> {
    const [data, total] = await this.ulbMasterRepository.findAndCount({
      where: { 
        ulb_name: ulbName,
        status: UlbStatus.ACTIVE
      },
      select: ['id', 'state_name', 'city_name', 'ulb_name', 'ulb_type'],
      order: { 
        state_name: 'ASC',
        ulb_name: 'ASC'
      },
    });
    return { total, data };
  }
}