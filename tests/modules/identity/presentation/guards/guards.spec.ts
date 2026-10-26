import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '@/modules/identity/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/identity/presentation/guards/permissions.guard';

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as never;
}

describe('JwtAuthGuard', () => {
  const claims = { sub: 'u1', permissions: ['study.access'] };
  const tokens = { verifyAccessToken: jest.fn().mockResolvedValue(claims) };
  const guard = new JwtAuthGuard(tokens as never);

  it('attaches the verified claims', async () => {
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer abc' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith('abc');
    expect(request.user).toBe(claims);
  });

  it.each([undefined, 'Basic abc', 'bearer abc'])('rejects header %p', async (authorization) => {
    await expect(
      guard.canActivate(contextFor({ headers: { authorization } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('PermissionsGuard', () => {
  const build = (required: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  };

  it('passes routes without requirements', () => {
    expect(build(undefined).canActivate(contextFor({}))).toBe(true);
    expect(build([]).canActivate(contextFor({}))).toBe(true);
  });

  it('lets admins through', () => {
    const request = { user: { permissions: ['users.manage'] } };
    expect(build(['users.manage']).canActivate(contextFor(request))).toBe(true);
  });

  it('blocks students from the admin area', () => {
    const request = { user: { permissions: ['study.access'] } };
    expect(() => build(['users.manage']).canActivate(contextFor(request))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks requests without a user', () => {
    expect(() => build(['users.manage']).canActivate(contextFor({}))).toThrow(ForbiddenException);
  });
});
