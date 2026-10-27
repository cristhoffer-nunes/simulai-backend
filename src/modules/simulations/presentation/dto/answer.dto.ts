import { IsString, Matches, ValidateIf } from 'class-validator';

export class SaveAnswerDto {
  /** "A"…"F", or null to clear the mark. */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^[A-F]$/)
  selectedOptionId!: string | null;
}
