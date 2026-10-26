import { AppConfigService } from '@/config/app-config.service';
import { Role } from '@/modules/identity/domain/entities/role.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { IRoleRepository } from '@/modules/identity/domain/repositories/role.repository';
import { IUserRepository } from '@/modules/identity/domain/repositories/user.repository';
import { DisplayName } from '@/modules/identity/domain/value-objects/display-name.vo';
import { Email } from '@/modules/identity/domain/value-objects/email.vo';
import { IEmailPort } from '@/modules/identity/application/ports/email.port';
import { IPasswordHasherPort } from '@/modules/identity/application/ports/password-hasher.port';
import { IPasswordResetTokenPort } from '@/modules/identity/application/ports/password-reset-token.port';
import { IPasswordResetTokenStorePort } from '@/modules/identity/application/ports/password-reset-token-store.port';
import { IRateLimiterPort } from '@/modules/identity/application/ports/rate-limiter.port';
import { IRefreshTokenStorePort } from '@/modules/identity/application/ports/refresh-token-store.port';
import { ITokenServicePort } from '@/modules/identity/application/ports/token.port';
import { SessionIssuer } from '@/modules/identity/application/session-issuer';

export function buildUser(overrides: Partial<Parameters<typeof User.reconstitute>[0]> = {}): User {
  return User.reconstitute({
    id: 'user-1',
    email: Email.create('mariana@exemplo.com').value,
    passwordHash: 'hashed-password',
    displayName: DisplayName.create('Mariana Souza').value,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
    ...overrides,
  });
}

export const studentRole = Role.reconstitute({
  id: 'role-student',
  name: 'student',
  permissions: ['study.access'],
});

export const adminRole = Role.reconstitute({
  id: 'role-admin',
  name: 'admin',
  permissions: ['users.manage'],
});

export function fakeUsers(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    findByEmail: jest.fn().mockResolvedValue(buildUser()),
    findById: jest.fn().mockResolvedValue(buildUser()),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    createWithRole: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    replaceRole: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IUserRepository>;
}

export function fakeRoles(overrides: Partial<IRoleRepository> = {}): jest.Mocked<IRoleRepository> {
  return {
    findByName: jest.fn(async (name: string) =>
      name === 'student' ? studentRole : name === 'admin' ? adminRole : null,
    ),
    findRolesForUser: jest.fn().mockResolvedValue([studentRole]),
    ...overrides,
  } as jest.Mocked<IRoleRepository>;
}

export function fakeHasher(
  overrides: Partial<IPasswordHasherPort> = {},
): jest.Mocked<IPasswordHasherPort> {
  return {
    hash: jest.fn().mockResolvedValue('new-hash'),
    compare: jest.fn().mockResolvedValue(true),
    unusableHash: jest.fn().mockResolvedValue('unusable-hash'),
    ...overrides,
  } as jest.Mocked<IPasswordHasherPort>;
}

export function fakeTokens(
  overrides: Partial<ITokenServicePort> = {},
): jest.Mocked<ITokenServicePort> {
  return {
    signAccessToken: jest.fn().mockResolvedValue('signed.access.token'),
    verifyAccessToken: jest.fn(),
    getPublicKeyPem: jest.fn().mockReturnValue('PEM'),
    ...overrides,
  } as jest.Mocked<ITokenServicePort>;
}

export function fakeRefreshTokens(
  overrides: Partial<IRefreshTokenStorePort> = {},
): jest.Mocked<IRefreshTokenStorePort> {
  return {
    issue: jest
      .fn()
      .mockResolvedValue({ token: 'refresh-token', tokenId: 'hash', expiresAt: new Date() }),
    rotate: jest.fn(),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IRefreshTokenStorePort>;
}

export function fakeRateLimiter(
  overrides: Partial<IRateLimiterPort> = {},
): jest.Mocked<IRateLimiterPort> {
  return {
    consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
    reset: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IRateLimiterPort>;
}

export function fakeResetTokens(
  overrides: Partial<IPasswordResetTokenPort> = {},
): jest.Mocked<IPasswordResetTokenPort> {
  return {
    issue: jest.fn().mockResolvedValue({ token: 'reset.jwt', jti: 'jti-1', ttlSeconds: 3600 }),
    verify: jest.fn(),
    ...overrides,
  } as jest.Mocked<IPasswordResetTokenPort>;
}

export function fakeResetTokenStore(
  overrides: Partial<IPasswordResetTokenStorePort> = {},
): jest.Mocked<IPasswordResetTokenStorePort> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    isValid: jest.fn().mockResolvedValue(true),
    consume: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IPasswordResetTokenStorePort>;
}

export function fakeEmail(overrides: Partial<IEmailPort> = {}): jest.Mocked<IEmailPort> {
  return {
    sendInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IEmailPort>;
}

export const fakeConfig = {
  loginRateLimit: { maxAttempts: 5, windowSeconds: 900 },
  refreshRateLimit: { maxAttempts: 20, windowSeconds: 900 },
  forgotPasswordRateLimit: { maxAttempts: 3, windowSeconds: 3600 },
  jwt: {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 1_209_600,
    privateKeyPath: 'keys/private.pem',
    publicKeyPath: 'keys/public.pem',
  },
  passwordReset: { recoveryTtlSeconds: 3600, firstAccessTtlSeconds: 259_200 },
  frontendUrl: 'https://app.simulai.test',
  email: { resendApiKey: 're_test', fromAddress: 'Simulai <no-reply@simulai.test>' },
} as unknown as AppConfigService;

export function buildSessionIssuer(
  tokens = fakeTokens(),
  refresh = fakeRefreshTokens(),
  roles = fakeRoles(),
): SessionIssuer {
  return new SessionIssuer(roles, tokens, refresh, fakeConfig);
}
