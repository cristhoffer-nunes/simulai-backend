import { IsString, MaxLength, MinLength } from 'class-validator';

export class ValidateResetTokenQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token!: string;
}
