import { IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { FormStatus } from '../../entities/form.entity';

export class UpdateFormStatusDto {
  @IsString()
  @IsOptional()
  formId?: string;

  @IsEnum(FormStatus)
  @IsNotEmpty()
  status: FormStatus;
}

