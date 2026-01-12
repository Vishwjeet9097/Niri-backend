import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  submissionIndicatorId: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

