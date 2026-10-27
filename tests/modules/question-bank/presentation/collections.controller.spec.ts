import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { CollectionsController } from '@/modules/question-bank/presentation/controllers/collections.controller';

const user = { sub: 'u1' } as never;
const ok = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(Result.ok(value)) });
const fail = () => ({
  execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))),
});

describe('CollectionsController', () => {
  it('requires study.access', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, CollectionsController)).toEqual(['study.access']);
  });

  it('delegates each route with the authenticated user', async () => {
    const [list, get, create, update, remove, add, removeQuestion] = [
      ok({ items: [] }),
      ok({ id: 'c1' }),
      ok({ id: 'c1' }),
      ok({ id: 'c1' }),
      ok(undefined),
      ok({ added: 1 }),
      ok(undefined),
    ];
    const controller = new CollectionsController(
      list as never,
      get as never,
      create as never,
      update as never,
      remove as never,
      add as never,
      removeQuestion as never,
    );
    await controller.list(user);
    await controller.create(user, { name: 'N' });
    expect(create.execute).toHaveBeenCalledWith({ userId: 'u1', name: 'N' });
    await controller.detail(user, 'c1');
    await controller.update(user, 'c1', { description: null });
    expect(update.execute).toHaveBeenCalledWith({
      userId: 'u1',
      collectionId: 'c1',
      description: null,
    });
    await controller.remove(user, 'c1');
    await expect(controller.addMany(user, 'c1', { questionIds: ['q1'] })).resolves.toEqual({
      added: 1,
    });
    await controller.addOne(user, 'c1', 'q2');
    expect(add.execute).toHaveBeenLastCalledWith({
      userId: 'u1',
      collectionId: 'c1',
      questionIds: ['q2'],
    });
    await controller.removeOne(user, 'c1', 'q2');
    expect(removeQuestion.execute).toHaveBeenCalledWith('u1', 'c1', 'q2');
  });

  it('maps failures', async () => {
    const f = fail;
    const controller = new CollectionsController(
      f() as never,
      f() as never,
      f() as never,
      f() as never,
      f() as never,
      f() as never,
      f() as never,
    );
    await expect(controller.list(user)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.create(user, { name: '' })).rejects.toBeInstanceOf(DomainException);
    await expect(controller.detail(user, 'c')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.update(user, 'c', {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.remove(user, 'c')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.addMany(user, 'c', { questionIds: ['q'] })).rejects.toBeInstanceOf(
      DomainException,
    );
    await expect(controller.addOne(user, 'c', 'q')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.removeOne(user, 'c', 'q')).rejects.toBeInstanceOf(DomainException);
  });
});
