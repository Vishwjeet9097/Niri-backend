import { IsString, IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveAssignedIndicatorDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  ministryUserId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  indicatorsId: string[];
}

