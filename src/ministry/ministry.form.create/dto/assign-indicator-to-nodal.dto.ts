import { IsString, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class AssignIndicatorToNodalDto {
  @IsString()
  @IsNotEmpty()
  nodalUserId: string;

  @IsString()
  @IsNotEmpty()
  ministryUserId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  indicatorsId: string[];
}

