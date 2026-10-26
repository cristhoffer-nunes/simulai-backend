import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../../config/app-config.service';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { User } from '../../domain/entities/user.entity';
import { ROLE_REPOSITORY, IRoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { ASSIGNABLE_ROLES, RoleName } from '../../domain/services/access-policy';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { Email } from '../../domain/value-objects/email.vo';
import { buildAccessUrl, humanizeTtl } from '../access-link';
import { toUserSummary, UserSummary } from '../dto/user-summary';
import { EMAIL_PORT, IEmailPort } from '../ports/email.port';
import { PASSWORD_HASHER, IPasswordHasherPort } from '../ports/password-hasher.port';
import {
  PASSWORD_RESET_TOKEN_SERVICE,
  IPasswordResetTokenPort,
} from '../ports/password-reset-token.port';
import {
  PASSWORD_RESET_TOKEN_STORE,
  IPasswordResetTokenStorePort,
} from '../ports/password-reset-token-store.port';

export interface CreateUserInput {
  email: string;
  displayName: string;
  role: string;
}

export interface CreateUserOutput {
  user: UserSummary;
  /**
   * First-access link, also emailed to the user. Returned to the administrator so onboarding
   * still works when email delivery is not configured (they can send it by another channel).
   */
  accessLink: string;
  emailSent: boolean;
}

export interface ICreateUserUseCase {
  execute(input: CreateUserInput): Promise<Result<CreateUserOutput, AppError>>;
}

export const CREATE_USER_USE_CASE = Symbol('CREATE_USER_USE_CASE');

@Injectable()
export class CreateUserUseCase implements ICreateUserUseCase {
  private readonly logger = new Logger(CreateUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasherPort,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE) private readonly resetTokens: IPasswordResetTokenPort,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly resetTokenStore: IPasswordResetTokenStorePort,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    private readonly config: AppConfigService,
  ) {}

  async execute(input: CreateUserInput): Promise<Result<CreateUserOutput, AppError>> {
    const email = Email.create(input.email);
    if (email.isFailure) return Result.fail(AppError.validation(email.error));

    const name = DisplayName.create(input.displayName);
    if (name.isFailure) return Result.fail(AppError.validation(name.error));

    if (!ASSIGNABLE_ROLES.includes(input.role as RoleName)) {
      return Result.fail(AppError.roleNotFound(input.role));
    }
    const role = await this.roles.findByName(input.role);
    if (!role) return Result.fail(AppError.roleNotFound(input.role));

    if (await this.users.findByEmail(email.value.toString())) {
      return Result.fail(AppError.emailAlreadyInUse(email.value.toString()));
    }

    const user = User.create(email.value, name.value, await this.hasher.unusableHash());
    await this.users.createWithRole(user, role.id);

    const { token, jti, ttlSeconds } = await this.resetTokens.issue(
      user.id,
      user.email.toString(),
      'first_access',
    );
    await this.resetTokenStore.save(user.id, jti, ttlSeconds);
    const accessLink = buildAccessUrl(this.config.frontendUrl, token);

    const emailSent = await this.sendInvite(user, accessLink, ttlSeconds);

    return Result.ok({ user: toUserSummary(user, [role.name]), accessLink, emailSent });
  }

  // Best effort: the account exists at this point; a failing email provider must not undo it.
  private async sendInvite(user: User, accessLink: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.email.sendInviteEmail({
        to: user.email.toString(),
        userName: user.displayName.toString(),
        accessUrl: accessLink,
        validFor: humanizeTtl(ttlSeconds),
      });
      return true;
    } catch (error) {
      this.logger.warn(`Failed to send invite email: ${(error as Error).message}`);
      return false;
    }
  }
}
