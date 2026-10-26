import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '@/config/app-config.service';
import { JwtRs256TokenAdapter } from '@/modules/identity/infrastructure/adapters/jwt-rs256-token.adapter';
import { JwtPasswordResetTokenAdapter } from '@/modules/identity/infrastructure/adapters/jwt-password-reset-token.adapter';
import { writeTestKeys } from '../../../../helpers/keys';

describe('JWT adapters', () => {
  const keys = writeTestKeys();
  const otherKeys = writeTestKeys();
  const config = (paths = keys) =>
    ({
      jwt: { ...paths, accessTokenTtlSeconds: 900 },
      passwordReset: { recoveryTtlSeconds: 3600, firstAccessTtlSeconds: 259_200 },
    }) as unknown as AppConfigService;
  const jwt = new JwtService({});

  describe('JwtRs256TokenAdapter', () => {
    const adapter = new JwtRs256TokenAdapter(jwt, config());

    it('signs and verifies access tokens', async () => {
      const token = await adapter.signAccessToken({
        sub: 'u1',
        email: 'a@b.co',
        roles: ['student'],
        permissions: ['study.access'],
      });
      const claims = await adapter.verifyAccessToken(token);

      expect(claims).toEqual(
        expect.objectContaining({ sub: 'u1', roles: ['student'], aud: 'simulai' }),
      );
      expect(claims.exp - claims.iat).toBe(900);
      expect(adapter.getPublicKeyPem()).toContain('BEGIN PUBLIC KEY');
    });

    it('rejects tokens signed with another key (e.g. lawsuits-management)', async () => {
      const foreign = new JwtRs256TokenAdapter(jwt, config(otherKeys));
      const token = await foreign.signAccessToken({
        sub: 'u',
        email: 'e',
        roles: [],
        permissions: [],
      });

      await expect(adapter.verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a password-reset token presented as an access token', async () => {
      const reset = new JwtPasswordResetTokenAdapter(jwt, config());
      const { token } = await reset.issue('u1', 'a@b.co', 'recovery');

      await expect(adapter.verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('JwtPasswordResetTokenAdapter', () => {
    const adapter = new JwtPasswordResetTokenAdapter(jwt, config());

    it.each([
      ['first_access', 259_200],
      ['recovery', 3600],
    ] as const)('issues %s links with their own TTL', async (type, ttl) => {
      const issued = await adapter.issue('u1', 'a@b.co', type);
      const claims = await adapter.verify(issued.token);

      expect(issued.ttlSeconds).toBe(ttl);
      expect(claims).toEqual(expect.objectContaining({ sub: 'u1', type, jti: issued.jti }));
      expect(claims!.exp - claims!.iat).toBe(ttl);
    });

    it('returns null for garbage and for access tokens', async () => {
      const access = new JwtRs256TokenAdapter(jwt, config());
      const token = await access.signAccessToken({
        sub: 'u',
        email: 'e',
        roles: [],
        permissions: [],
      });

      await expect(adapter.verify('not-a-jwt')).resolves.toBeNull();
      await expect(adapter.verify(token)).resolves.toBeNull();
    });
  });
});
