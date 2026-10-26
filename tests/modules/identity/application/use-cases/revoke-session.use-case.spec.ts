import { RevokeSessionUseCase } from '@/modules/identity/application/use-cases/revoke-session.use-case';
import { fakeRefreshTokens } from '../../../../helpers/identity-fakes';

describe('RevokeSessionUseCase', () => {
  it('revokes the given refresh token', async () => {
    const refresh = fakeRefreshTokens();
    const result = await new RevokeSessionUseCase(refresh).execute('token');

    expect(result.isSuccess).toBe(true);
    expect(refresh.revoke).toHaveBeenCalledWith('token');
  });
});
