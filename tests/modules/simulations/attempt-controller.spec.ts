import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { AttemptsController } from '@/modules/simulations/presentation/controllers/attempts.controller';

const user = { sub: 'u1' } as never;
const ok = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(Result.ok(value)) });
const fail = () => ({
  execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))),
});

describe('AttemptsController', () => {
  it('delegates with the authenticated student', async () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AttemptsController)).toEqual(['study.access']);
    const [start, get, save, finish, result] = [
      ok({ id: 'a' }),
      ok({ id: 'a' }),
      ok({ questionId: 'q' }),
      ok({ attemptId: 'a' }),
      ok({ attemptId: 'a' }),
    ];
    const controller = new AttemptsController(
      start as never,
      get as never,
      save as never,
      finish as never,
      result as never,
    );
    await controller.start(user, 'sim');
    expect(start.execute).toHaveBeenCalledWith('u1', 'sim');
    await controller.detail(user, 'a');
    await controller.answer(user, 'a', 'q', { selectedOptionId: null });
    expect(save.execute).toHaveBeenCalledWith({
      userId: 'u1',
      attemptId: 'a',
      questionId: 'q',
      selectedOptionId: null,
      flagged: undefined,
    });
    await controller.answer(user, 'a', 'q', { flagged: true });
    expect(save.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedOptionId: undefined, flagged: true }),
    );
    await controller.finish(user, 'a');
    expect(finish.execute).toHaveBeenCalledWith('u1', 'a');
    await controller.result(user, 'a');
    expect(result.execute).toHaveBeenCalledWith('u1', 'a');
  });

  it('maps failures', async () => {
    const controller = new AttemptsController(
      fail() as never,
      fail() as never,
      fail() as never,
      fail() as never,
      fail() as never,
    );
    await expect(controller.start(user, 's')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.detail(user, 'a')).rejects.toBeInstanceOf(DomainException);
    await expect(
      controller.answer(user, 'a', 'q', { selectedOptionId: 'A' }),
    ).rejects.toBeInstanceOf(DomainException);
    await expect(controller.finish(user, 'a')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.result(user, 'a')).rejects.toBeInstanceOf(DomainException);
  });
});
