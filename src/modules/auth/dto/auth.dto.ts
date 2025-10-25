import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  IsIn,
  IsArray,
  IsString as IsStringArray,
} from "class-validator";
import { UserRole } from "../../../entities/user.entity";
import { INDIAN_STATES_AND_UTS } from "../../../constants/states";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsIn(INDIAN_STATES_AND_UTS, { message: "Please select a valid state/UT" })
  stateUt: string;

  @IsOptional()
  @IsArray()
  @IsStringArray({ each: true })
  indicatorCodes?: string[]; // e.g., ['1.1', '1.2', '2.1']
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @IsIn(INDIAN_STATES_AND_UTS, { message: "Please select a valid state/UT" })
  stateUt?: string;

  @IsOptional()
  password?: string;

  @IsOptional()
  @IsArray()
  indicatorCodes?: (string | number)[]; // e.g., ['1.1', '1.2', '2.1'] or [1.1, 1.2, 2.1]
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
