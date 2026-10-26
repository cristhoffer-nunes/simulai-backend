import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ASSIGNABLE_ROLES } from '../../domain/services/access-policy';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
