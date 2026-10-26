import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { TOKEN_SERVICE } from './application/ports/token.port';
import { REFRESH_TOKEN_STORE } from './application/ports/refresh-token-store.port';
import { RATE_LIMITER } from './application/ports/rate-limiter.port';
import { EMAIL_PORT } from './application/ports/email.port';
import { PASSWORD_RESET_TOKEN_SERVICE } from './application/ports/password-reset-token.port';
import { PASSWORD_RESET_TOKEN_STORE } from './application/ports/password-reset-token-store.port';
import { SESSION_ISSUER, SessionIssuer } from './application/session-issuer';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { PrismaRoleRepository } from './infrastructure/repositories/prisma-role.repository';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtRs256TokenAdapter } from './infrastructure/adapters/jwt-rs256-token.adapter';
import { PrismaRefreshTokenStoreAdapter } from './infrastructure/adapters/prisma-refresh-token-store.adapter';
import { PrismaRateLimiterAdapter } from './infrastructure/adapters/prisma-rate-limiter.adapter';
import { AuthStateCleanupService } from './infrastructure/auth-state-cleanup.service';
import { ResendEmailAdapter } from './infrastructure/adapters/resend-email.adapter';
import { JwtPasswordResetTokenAdapter } from './infrastructure/adapters/jwt-password-reset-token.adapter';
import { PrismaPasswordResetTokenStoreAdapter } from './infrastructure/adapters/prisma-password-reset-token-store.adapter';
import {
  AUTHENTICATE_USER_USE_CASE,
  AuthenticateUserUseCase,
} from './application/use-cases/authenticate-user.use-case';
import {
  REFRESH_SESSION_USE_CASE,
  RefreshSessionUseCase,
} from './application/use-cases/refresh-session.use-case';
import {
  REVOKE_SESSION_USE_CASE,
  RevokeSessionUseCase,
} from './application/use-cases/revoke-session.use-case';
import {
  FORGOT_PASSWORD_USE_CASE,
  ForgotPasswordUseCase,
} from './application/use-cases/forgot-password.use-case';
import {
  VALIDATE_RESET_TOKEN_USE_CASE,
  ValidateResetTokenUseCase,
} from './application/use-cases/validate-reset-token.use-case';
import {
  RESET_PASSWORD_USE_CASE,
  ResetPasswordUseCase,
} from './application/use-cases/reset-password.use-case';
import {
  GET_MY_PROFILE_USE_CASE,
  GetMyProfileUseCase,
} from './application/use-cases/get-my-profile.use-case';
import {
  UPDATE_MY_PROFILE_USE_CASE,
  UpdateMyProfileUseCase,
} from './application/use-cases/update-my-profile.use-case';
import {
  CREATE_USER_USE_CASE,
  CreateUserUseCase,
} from './application/use-cases/create-user.use-case';
import { LIST_USERS_USE_CASE, ListUsersUseCase } from './application/use-cases/list-users.use-case';
import {
  UPDATE_USER_USE_CASE,
  UpdateUserUseCase,
} from './application/use-cases/update-user.use-case';
import {
  ISSUE_ACCESS_LINK_USE_CASE,
  IssueAccessLinkUseCase,
} from './application/use-cases/issue-access-link.use-case';
import { AuthController } from './presentation/controllers/auth.controller';
import { MeController } from './presentation/controllers/me.controller';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from './presentation/guards/permissions.guard';

// Identity & access bounded context: authentication, sessions, own profile, and the admin area
// that manages accounts. Other modules reuse JwtAuthGuard/PermissionsGuard (study.access).
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, MeController, AdminUsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasherAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtRs256TokenAdapter },
    { provide: REFRESH_TOKEN_STORE, useClass: PrismaRefreshTokenStoreAdapter },
    { provide: RATE_LIMITER, useClass: PrismaRateLimiterAdapter },
    { provide: EMAIL_PORT, useClass: ResendEmailAdapter },
    { provide: PASSWORD_RESET_TOKEN_SERVICE, useClass: JwtPasswordResetTokenAdapter },
    { provide: PASSWORD_RESET_TOKEN_STORE, useClass: PrismaPasswordResetTokenStoreAdapter },
    AuthStateCleanupService,
    { provide: SESSION_ISSUER, useClass: SessionIssuer },
    { provide: AUTHENTICATE_USER_USE_CASE, useClass: AuthenticateUserUseCase },
    { provide: REFRESH_SESSION_USE_CASE, useClass: RefreshSessionUseCase },
    { provide: REVOKE_SESSION_USE_CASE, useClass: RevokeSessionUseCase },
    { provide: FORGOT_PASSWORD_USE_CASE, useClass: ForgotPasswordUseCase },
    { provide: VALIDATE_RESET_TOKEN_USE_CASE, useClass: ValidateResetTokenUseCase },
    { provide: RESET_PASSWORD_USE_CASE, useClass: ResetPasswordUseCase },
    { provide: GET_MY_PROFILE_USE_CASE, useClass: GetMyProfileUseCase },
    { provide: UPDATE_MY_PROFILE_USE_CASE, useClass: UpdateMyProfileUseCase },
    { provide: CREATE_USER_USE_CASE, useClass: CreateUserUseCase },
    { provide: LIST_USERS_USE_CASE, useClass: ListUsersUseCase },
    { provide: UPDATE_USER_USE_CASE, useClass: UpdateUserUseCase },
    { provide: ISSUE_ACCESS_LINK_USE_CASE, useClass: IssueAccessLinkUseCase },
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [TOKEN_SERVICE, JwtAuthGuard, PermissionsGuard],
})
export class IdentityModule {}
