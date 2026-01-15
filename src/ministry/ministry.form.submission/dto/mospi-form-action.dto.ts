import { IsString, IsOptional, IsUUID, IsEnum, IsNotEmpty } from 'class-validator';

export enum MospiFormAction {
  SEND_BACK = 'send-back',
  ACCEPT = 'accept',
  SUBMIT_TO_APPROVER = 'submit-to-approver',
}

export class MospiFormActionDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  formId?: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(MospiFormAction)
  action: MospiFormAction;
}

