import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token!: string;

  // Composition rules (upper/lower/digit/symbol) are enforced in ResetPasswordUseCase, which
  // returns WEAK_PASSWORD instead of a generic validation error.
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
