import { IsBoolean, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

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
