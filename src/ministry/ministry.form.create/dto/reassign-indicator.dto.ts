import { IsString, IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

export class ReassignIndicatorDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId: string; // User to assign indicators to

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  ministryUserId: string; // Ministry user who currently owns the indicators

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  indicatorsId: string[]; // Array of indicator IDs to reassign
}

