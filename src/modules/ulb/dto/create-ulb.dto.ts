import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { UlbStatus } from '../../../entities/ulb-master.entity';

export class CreateUlbDto {
  @IsNotEmpty()
  @IsString()
  state_name: string;

  @IsNotEmpty()
  @IsString()
  city_name: string;

  @IsOptional()
  @IsString()
  ulb_name?: string;

  @IsNotEmpty()
  @IsString()
  ulb_type: string;

  @IsOptional()
  @IsEnum(UlbStatus)
  status?: UlbStatus;
}
