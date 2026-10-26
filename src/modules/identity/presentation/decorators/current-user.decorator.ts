import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

export function currentUserFactory(_: unknown, ctx: ExecutionContext) {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
}

export const CurrentUser = createParamDecorator(currentUserFactory);
