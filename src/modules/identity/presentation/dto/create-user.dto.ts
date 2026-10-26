import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ASSIGNABLE_ROLES } from '../../domain/services/access-policy';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role!: string;
}
