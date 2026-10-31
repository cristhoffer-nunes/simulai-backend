import { IsBoolean, IsIn, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

/** Send either field, or both: the mark and/or the "review later" flag of one question. */
export class SaveAnswerDto {
  /** "A"…"F", or null to clear the mark. Omit to keep the current mark. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^[A-F]$/)
  selectedOptionId?: string | null;

  /** "Revisar depois". Omit to keep the current flag. */
  @IsOptional()
  @IsBoolean()
  flagged?: boolean;
}

/** Study mode: the option to lock in for one question. */
export class ConfirmAnswerDto {
  @IsString()
  @Matches(/^[A-F]$/)
  selectedOptionId!: string;
}

/** "Treinar": which questions go into the new simulation, and in which mode. */
export class ReviewSimulationDto {
  /** Defaults to the mode of the original simulation. */
  @IsOptional()
  @IsIn(['exam', 'study'])
  mode?: 'exam' | 'study';

  /** missed (default): wrong and blank questions; all: every question again. */
  @IsOptional()
  @IsIn(['missed', 'all'])
  questions?: 'missed' | 'all';
}
