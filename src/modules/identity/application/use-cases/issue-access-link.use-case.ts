import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../../config/app-config.service';
import { AppError } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { buildAccessUrl, humanizeTtl, linkTypeFor } from '../access-link';
import { EMAIL_PORT, IEmailPort } from '../ports/email.port';
import {
  PASSWORD_RESET_TOKEN_SERVICE,
  IPasswordResetTokenPort,
  PasswordResetTokenType,
} from '../ports/password-reset-token.port';
import {
  PASSWORD_RESET_TOKEN_STORE,
  IPasswordResetTokenStorePort,
} from '../ports/password-reset-token-store.port';

export interface IssueAccessLinkOutput {
  accessLink: string;
  type: PasswordResetTokenType;
  emailSent: boolean;
}

export interface IIssueAccessLinkUseCase {
  execute(userId: string): Promise<Result<IssueAccessLinkOutput, AppError>>;
}

export const ISSUE_ACCESS_LINK_USE_CASE = Symbol('ISSUE_ACCESS_LINK_USE_CASE');

/**
 * Administrator re-sends access: a first-access link while the invite is pending, otherwise a
 * password-recovery link. Issuing a new link invalidates the previous one.
 */
@Injectable()
export class IssueAccessLinkUseCase implements IIssueAccessLinkUseCase {
  private readonly logger = new Logger(IssueAccessLinkUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE) private readonly resetTokens: IPasswordResetTokenPort,
    @Inject(PASSWORD_RESET_TOKEN_STORE)
    private readonly resetTokenStore: IPasswordResetTokenStorePort,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    private readonly config: AppConfigService,
  ) {}

  async execute(userId: string): Promise<Result<IssueAccessLinkOutput, AppError>> {
    const user = await this.users.findById(userId);
    if (!user) return Result.fail(AppError.userNotFound(userId));
    if (!user.isActive) return Result.fail(AppError.userInactive());

    const type = linkTypeFor(user.mustChangePassword);
    const { token, jti, ttlSeconds } = await this.resetTokens.issue(
      user.id,
      user.email.toString(),
      type,
    );
    await this.resetTokenStore.save(user.id, jti, ttlSeconds);
    const accessLink = buildAccessUrl(this.config.frontendUrl, token);

    let emailSent = true;
    try {
      if (type === 'first_access') {
        await this.email.sendInviteEmail({
          to: user.email.toString(),
          userName: user.displayName.toString(),
          accessUrl: accessLink,
          validFor: humanizeTtl(ttlSeconds),
        });
      } else {
        await this.email.sendPasswordResetEmail({
          to: user.email.toString(),
          resetUrl: accessLink,
          validFor: humanizeTtl(ttlSeconds),
        });
      }
    } catch (error) {
      emailSent = false;
      this.logger.warn(`Failed to send access-link email: ${(error as Error).message}`);
    }

    return Result.ok({ accessLink, type, emailSent });
  }
}
