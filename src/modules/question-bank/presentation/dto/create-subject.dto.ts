import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @IsUUID()
  knowledgeAreaId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
