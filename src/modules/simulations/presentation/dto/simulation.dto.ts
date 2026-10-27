import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateSimulationDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsIn(['exam'])
  mode!: 'exam';

  @IsInt()
  @Min(1)
  @Max(200)
  questionCount!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  subjectIds!: string[];

  @IsIn(['all', 'easy', 'medium', 'hard'])
  difficulty!: 'all' | 'easy' | 'medium' | 'hard';

  @IsIn(['balanced'])
  distribution!: 'balanced';

  @IsBoolean()
  timed!: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(60)
  @Max(36000)
  durationSeconds?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  collectionId?: string | null;
}

export class AvailabilityQueryDto {
  @IsOptional()
  @IsIn(['all', 'easy', 'medium', 'hard'])
  difficulty?: 'all' | 'easy' | 'medium' | 'hard';

  @IsOptional()
  @IsUUID()
  collectionId?: string;
}

export class ListSimulationsQueryDto {
  @IsOptional()
  @IsIn(['ready', 'archived'])
  status?: 'ready' | 'archived';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateSimulationDto {
  @IsIn(['ready', 'archived'])
  status!: 'ready' | 'archived';
}
