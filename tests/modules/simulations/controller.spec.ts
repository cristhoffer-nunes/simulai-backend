import { AppError, ExamErrors, ERROR_KIND_HTTP_STATUS } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { SimulationsController } from '@/modules/simulations/presentation/controllers/simulations.controller';

const user = { sub: 'u1' } as never;
const ok = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(Result.ok(value)) });
const fail = () => ({
  execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))),
  fromQuestions: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))),
});

describe('SimulationsController', () => {
  it('is student-only and delegates every route', async () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SimulationsController)).toEqual(['study.access']);
    const [availability, create, list, get, status] = [
      ok({ subjects: [] }),
      { ...ok({ id: 's' }), fromQuestions: jest.fn().mockResolvedValue(Result.ok({ id: 'f' })) },
      ok({ items: [] }),
      ok({ id: 's' }),
      ok({ id: 's' }),
    ];
    const controller = new SimulationsController(
      availability as never,
      create as never,
      list as never,
      get as never,
      status as never,
    );
    await controller.available(user, {});
    expect(availability.execute).toHaveBeenCalledWith({
      userId: 'u1',
      difficulty: 'all',
      collectionId: undefined,
    });
    await controller.available(user, { difficulty: 'hard', collectionId: 'c1' });
    expect(availability.execute).toHaveBeenLastCalledWith({
      userId: 'u1',
      difficulty: 'hard',
      collectionId: 'c1',
    });
    await controller.create(user, { mode: 'exam', questionCount: 2 } as never);
    expect(create.execute).toHaveBeenCalledWith({ userId: 'u1', mode: 'exam', questionCount: 2 });
    expect(await controller.fromQuestions(user, { questionIds: ['q1'] })).toEqual({ id: 'f' });
    expect(create.fromQuestions).toHaveBeenCalledWith({ userId: 'u1', questionIds: ['q1'] });
    await controller.list(user, { limit: 5 });
    await controller.detail(user, 's');
    await controller.update(user, 's', { status: 'archived' });
    expect(status.execute).toHaveBeenCalledWith('u1', 's', 'archived');
  });

  it('maps failures', async () => {
    const controller = new SimulationsController(
      fail() as never,
      fail() as never,
      fail() as never,
      fail() as never,
      fail() as never,
    );
    await expect(controller.available(user, {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.create(user, {} as never)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.fromQuestions(user, { questionIds: [] })).rejects.toBeInstanceOf(
      DomainException,
    );
    await expect(controller.list(user, {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.detail(user, 's')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.update(user, 's', { status: 'ready' })).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  it('exam errors have their HTTP statuses', () => {
    expect(ERROR_KIND_HTTP_STATUS[ExamErrors.insufficientQuestions([]).kind]).toBe(422);
    expect(ExamErrors.attemptAlreadyActive('a1').details).toEqual({ attemptId: 'a1' });
    expect(ERROR_KIND_HTTP_STATUS[ExamErrors.attemptFinished('completed').kind]).toBe(409);
    expect(ERROR_KIND_HTTP_STATUS[ExamErrors.simulationArchived().kind]).toBe(409);
  });
});
