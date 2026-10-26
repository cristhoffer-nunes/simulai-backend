import { ValidateResetTokenUseCase } from '@/modules/identity/application/use-cases/validate-reset-token.use-case';
import { fakeResetTokens, fakeResetTokenStore } from '../../../../helpers/identity-fakes';

describe('ValidateResetTokenUseCase', () => {
  const claims = {
    sub: 'user-1',
    email: 'a@b.co',
    type: 'first_access' as const,
    jti: 'j',
    iat: 1,
    exp: 2,
  };

  it('returns email and link type for a live token', async () => {
    const useCase = new ValidateResetTokenUseCase(
      fakeResetTokens({ verify: jest.fn().mockResolvedValue(claims) }),
      fakeResetTokenStore(),
    );

    const result = await useCase.execute('t');

    expect(result.value).toEqual({ email: 'a@b.co', type: 'first_access' });
  });

  it('fails for a forged or expired token', async () => {
    const useCase = new ValidateResetTokenUseCase(
      fakeResetTokens({ verify: jest.fn().mockResolvedValue(null) }),
      fakeResetTokenStore(),
    );

    expect((await useCase.execute('t')).error.kind).toBe('INVALID_RESET_TOKEN');
  });

  it('fails for a token already used or replaced by a newer one', async () => {
    const useCase = new ValidateResetTokenUseCase(
      fakeResetTokens({ verify: jest.fn().mockResolvedValue(claims) }),
      fakeResetTokenStore({ isValid: jest.fn().mockResolvedValue(false) }),
    );

    expect((await useCase.execute('t')).error.kind).toBe('INVALID_RESET_TOKEN');
  });
});
