import { IsOptional, IsString, IsEnum } from 'class-validator';
import { UlbStatus } from '../../../entities/ulb-master.entity';

export class UpdateUlbDto {
  @IsOptional()
  @IsString()
  state_name?: string;

  @IsOptional()
  @IsString()
  city_name?: string;

  @IsOptional()
  @IsString()
  ulb_type?: string;

  @IsOptional()
  @IsEnum(UlbStatus)
  status?: UlbStatus;
}
