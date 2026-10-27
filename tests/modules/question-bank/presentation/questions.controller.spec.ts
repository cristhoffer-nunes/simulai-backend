import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { QuestionsController } from '@/modules/question-bank/presentation/controllers/questions.controller';

const user = { sub: 'u1' } as never;
const ok = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(Result.ok(value)) });
const fail = () => ({
  execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))),
});

describe('QuestionsController', () => {
  it('requires study.access', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, QuestionsController)).toEqual(['study.access']);
  });

  it('passes the authenticated user to every use case', async () => {
    const list = ok({ items: [] });
    const get = ok({ id: 'q1' });
    const create = ok({ id: 'q1' });
    const update = ok({ id: 'q1' });
    const archive = ok(undefined);
    const controller = new QuestionsController(
      list as never,
      get as never,
      create as never,
      update as never,
      archive as never,
    );

    await controller.list(user, { difficulty: 'easy' });
    expect(list.execute).toHaveBeenCalledWith({ userId: 'u1', difficulty: 'easy' });
    await controller.create(user, { subjectId: 's' } as never);
    expect(create.execute).toHaveBeenCalledWith({ userId: 'u1', subjectId: 's' });
    await controller.detail(user, 'q1');
    expect(get.execute).toHaveBeenCalledWith('u1', 'q1');
    await controller.update(user, 'q1', { status: 'archived' });
    expect(update.execute).toHaveBeenCalledWith({
      userId: 'u1',
      questionId: 'q1',
      status: 'archived',
    });
    await expect(controller.archive(user, 'q1')).resolves.toBeUndefined();
  });

  it('maps failures to DomainException', async () => {
    const controller = new QuestionsController(
      fail() as never,
      fail() as never,
      fail() as never,
      fail() as never,
      fail() as never,
    );
    await expect(controller.list(user, {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.create(user, {} as never)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.detail(user, 'q')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.update(user, 'q', {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.archive(user, 'q')).rejects.toBeInstanceOf(DomainException);
  });
});
