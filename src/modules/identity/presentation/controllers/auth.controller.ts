import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import {
  AUTHENTICATE_USER_USE_CASE,
  IAuthenticateUserUseCase,
} from '../../application/use-cases/authenticate-user.use-case';
import {
  REFRESH_SESSION_USE_CASE,
  IRefreshSessionUseCase,
} from '../../application/use-cases/refresh-session.use-case';
import {
  REVOKE_SESSION_USE_CASE,
  IRevokeSessionUseCase,
} from '../../application/use-cases/revoke-session.use-case';
import {
  FORGOT_PASSWORD_USE_CASE,
  IForgotPasswordUseCase,
} from '../../application/use-cases/forgot-password.use-case';
import {
  VALIDATE_RESET_TOKEN_USE_CASE,
  IValidateResetTokenUseCase,
} from '../../application/use-cases/validate-reset-token.use-case';
import {
  RESET_PASSWORD_USE_CASE,
  IResetPasswordUseCase,
} from '../../application/use-cases/reset-password.use-case';
import { TOKEN_SERVICE, ITokenServicePort } from '../../application/ports/token.port';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ValidateResetTokenQueryDto } from '../dto/validate-reset-token-query.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTHENTICATE_USER_USE_CASE) private readonly authenticateUser: IAuthenticateUserUseCase,
    @Inject(REFRESH_SESSION_USE_CASE) private readonly refreshSession: IRefreshSessionUseCase,
    @Inject(REVOKE_SESSION_USE_CASE) private readonly revokeSession: IRevokeSessionUseCase,
    @Inject(FORGOT_PASSWORD_USE_CASE) private readonly forgotPassword: IForgotPasswordUseCase,
    @Inject(VALIDATE_RESET_TOKEN_USE_CASE)
    private readonly validateResetToken: IValidateResetTokenUseCase,
    @Inject(RESET_PASSWORD_USE_CASE) private readonly resetPassword: IResetPasswordUseCase,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenServicePort,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: FastifyRequest) {
    const result = await this.authenticateUser.execute({
      email: dto.email,
      password: dto.password,
      ip: request.ip,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() request: FastifyRequest) {
    const result = await this.refreshSession.execute({
      refreshToken: dto.refreshToken,
      ip: request.ip,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto): Promise<void> {
    const result = await this.revokeSession.execute(dto.refreshToken);
    if (result.isFailure) throw new DomainException(result.error);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(@Body() dto: ForgotPasswordDto, @Req() request: FastifyRequest) {
    const result = await this.forgotPassword.execute({ email: dto.email, ip: request.ip });
    if (result.isFailure) throw new DomainException(result.error);
    return {};
  }

  @Get('reset-password/validate')
  @HttpCode(HttpStatus.OK)
  async checkResetToken(@Query() query: ValidateResetTokenQueryDto) {
    const result = await this.validateResetToken.execute(query.token);
    if (result.isFailure) return { valid: false };
    return { valid: true, ...result.value };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async completePasswordReset(@Body() dto: ResetPasswordDto) {
    const result = await this.resetPassword.execute(dto);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get('public-key')
  publicKey(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header('content-type', 'application/x-pem-file');
    return this.tokens.getPublicKeyPem();
  }
}
