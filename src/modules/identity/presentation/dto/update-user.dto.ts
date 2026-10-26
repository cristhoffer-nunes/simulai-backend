import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ASSIGNABLE_ROLES } from '../../domain/services/access-policy';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role?: string;
}
