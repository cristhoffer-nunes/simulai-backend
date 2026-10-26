import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { AdminUsersController } from '@/modules/identity/presentation/controllers/admin-users.controller';
import { AuthController } from '@/modules/identity/presentation/controllers/auth.controller';
import { MeController } from '@/modules/identity/presentation/controllers/me.controller';

const ok = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(Result.ok(value)) });
const fail = (error = AppError.invalidCredentials()) => ({
  execute: jest.fn().mockResolvedValue(Result.fail(error)),
});
const req = { ip: '10.0.0.1' } as never;

describe('AuthController', () => {
  function build(overrides: Partial<Record<string, { execute: jest.Mock }>> = {}) {
    const deps = {
      authenticate: ok({ accessToken: 'a' }),
      refresh: ok({ accessToken: 'b' }),
      revoke: ok(undefined),
      forgot: ok(undefined),
      validate: ok({ email: 'a@b.co', type: 'recovery' }),
      reset: ok({ accessToken: 'c' }),
      ...overrides,
    };
    const tokens = { getPublicKeyPem: () => 'PEM' };
    const controller = new AuthController(
      deps.authenticate as never,
      deps.refresh as never,
      deps.revoke as never,
      deps.forgot as never,
      deps.validate as never,
      deps.reset as never,
      tokens as never,
    );
    return { controller, deps };
  }

  it('delegates every route on success', async () => {
    const { controller, deps } = build();

    await expect(controller.login({ email: 'a@b.co', password: 'p' }, req)).resolves.toEqual({
      accessToken: 'a',
    });
    expect(deps.authenticate.execute).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'p',
      ip: '10.0.0.1',
    });
    await expect(controller.refresh({ refreshToken: 'r' }, req)).resolves.toEqual({
      accessToken: 'b',
    });
    await expect(controller.logout({ refreshToken: 'r' })).resolves.toBeUndefined();
    await expect(controller.requestPasswordReset({ email: 'a@b.co' }, req)).resolves.toEqual({});
    await expect(controller.checkResetToken({ token: 't' })).resolves.toEqual({
      valid: true,
      email: 'a@b.co',
      type: 'recovery',
    });
    await expect(
      controller.completePasswordReset({ token: 't', newPassword: 'X' }),
    ).resolves.toEqual({
      accessToken: 'c',
    });

    const reply = { header: jest.fn() };
    expect(controller.publicKey(reply as never)).toBe('PEM');
    expect(reply.header).toHaveBeenCalledWith('content-type', 'application/x-pem-file');
  });

  it('maps failures to DomainException (validate reports valid:false instead)', async () => {
    const { controller } = build({
      authenticate: fail(),
      refresh: fail(),
      revoke: fail(),
      forgot: fail(),
      validate: fail(),
      reset: fail(),
    });

    await expect(controller.login({ email: 'a', password: 'p' }, req)).rejects.toBeInstanceOf(
      DomainException,
    );
    await expect(controller.refresh({ refreshToken: 'r' }, req)).rejects.toBeInstanceOf(
      DomainException,
    );
    await expect(controller.logout({ refreshToken: 'r' })).rejects.toBeInstanceOf(DomainException);
    await expect(controller.requestPasswordReset({ email: 'a' }, req)).rejects.toBeInstanceOf(
      DomainException,
    );
    await expect(
      controller.completePasswordReset({ token: 't', newPassword: 'x' }),
    ).rejects.toBeInstanceOf(DomainException);
    await expect(controller.checkResetToken({ token: 't' })).resolves.toEqual({ valid: false });
  });
});

describe('MeController', () => {
  const user = { sub: 'u1' } as never;

  it('returns and updates the profile', async () => {
    const get = ok({ id: 'u1' });
    const update = ok({ id: 'u1', displayName: 'Ana' });
    const controller = new MeController(get as never, update as never);

    await expect(controller.me(user)).resolves.toEqual({ id: 'u1' });
    await controller.update(user, { displayName: 'Ana' });
    expect(update.execute).toHaveBeenCalledWith({ userId: 'u1', displayName: 'Ana' });
  });

  it('throws on failure', async () => {
    const controller = new MeController(fail() as never, fail() as never);
    await expect(controller.me(user)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.update(user, { displayName: 'x' })).rejects.toBeInstanceOf(
      DomainException,
    );
  });
});

describe('AdminUsersController', () => {
  const actor = { sub: 'admin-1' } as never;

  it('delegates list, create, update and access-link', async () => {
    const list = ok({ items: [], total: 0 });
    const create = ok({ user: {} });
    const update = ok({ id: 'u1' });
    const link = ok({ url: 'x' });
    const controller = new AdminUsersController(
      list as never,
      create as never,
      update as never,
      link as never,
    );

    await expect(controller.list({ page: 1 } as never)).resolves.toEqual({ items: [], total: 0 });
    await controller.create({ email: 'a@b.co', displayName: 'A', role: 'student' });
    await controller.update(actor, 'u1', { isActive: false });
    expect(update.execute).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      userId: 'u1',
      isActive: false,
    });
    await expect(controller.accessLink('u1')).resolves.toEqual({ url: 'x' });
  });

  it('throws on failure', async () => {
    const f = fail(AppError.userNotFound('u1'));
    const controller = new AdminUsersController(f as never, f as never, f as never, f as never);
    await expect(controller.list({} as never)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.create({} as never)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.update(actor, 'u1', {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.accessLink('u1')).rejects.toBeInstanceOf(DomainException);
  });
});
