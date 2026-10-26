import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AccessTokenClaims,
  TOKEN_SERVICE,
  ITokenServicePort,
} from '../../application/ports/token.port';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: ITokenServicePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = header.slice('Bearer '.length);
    request.user = await this.tokens.verifyAccessToken(token);
    return true;
  }
}
