import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../../entities/user.entity';

export class CreateMinistryFormDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  userRole: UserRole;

  @IsString()
  @IsNotEmpty()
  ministryId: string;
}
