import {
  buildSessionIssuer,
  buildUser,
  fakeRefreshTokens,
  fakeRoles,
  fakeTokens,
  adminRole,
  studentRole,
} from '../../../helpers/identity-fakes';

describe('SessionIssuer', () => {
  it('merges permissions from every role into the access token', async () => {
    const tokens = fakeTokens();
    const issuer = buildSessionIssuer(
      tokens,
      fakeRefreshTokens(),
      fakeRoles({ findRolesForUser: jest.fn().mockResolvedValue([adminRole, studentRole]) }),
    );

    const session = await issuer.openSession(buildUser());

    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'mariana@exemplo.com',
      roles: ['admin', 'student'],
      permissions: ['users.manage', 'study.access'],
    });
    expect(session).toEqual({
      accessToken: 'signed.access.token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 900,
    });
  });
});
