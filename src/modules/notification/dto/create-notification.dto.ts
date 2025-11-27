import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;


  @IsString()
  senderId: string;

  @IsString()
  submissionId: string;

  @IsOptional()
  @IsInt()
  status?: number;
}