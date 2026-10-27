import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { ImportsController } from '@/modules/question-bank/presentation/controllers/imports.controller';

const user = { sub: 'u1' } as never;

describe('ImportsController', () => {
  it('requires study.access and passes the raw body through', async () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ImportsController)).toEqual(['study.access']);
    const validate = { execute: jest.fn().mockResolvedValue(Result.ok({ previewId: 'p' })) };
    const discard = { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) };
    const commit = { execute: jest.fn().mockResolvedValue(Result.ok({ importId: 'i1' })) };
    const get = { execute: jest.fn().mockResolvedValue(Result.ok({ importId: 'i1' })) };
    const controller = new ImportsController(
      validate as never,
      discard as never,
      commit as never,
      get as never,
    );
    const body = { schemaVersion: '1.0', questions: [] };
    await expect(controller.validate(user, body)).resolves.toEqual({ previewId: 'p' });
    expect(validate.execute).toHaveBeenCalledWith('u1', body);
    await controller.discard(user, 'i1');
    expect(discard.execute).toHaveBeenCalledWith('u1', 'i1');
    const dto = { previewId: 'p', selectedIndexes: [0], idempotencyKey: 'key-12345' };
    await expect(controller.commit(user, dto)).resolves.toEqual({ importId: 'i1' });
    expect(commit.execute).toHaveBeenCalledWith({ userId: 'u1', ...dto });
    await expect(controller.detail(user, 'i1')).resolves.toEqual({ importId: 'i1' });
  });

  it('maps failures', async () => {
    const fail = { execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))) };
    const controller = new ImportsController(
      fail as never,
      fail as never,
      fail as never,
      fail as never,
    );
    await expect(controller.validate(user, {})).rejects.toBeInstanceOf(DomainException);
    await expect(controller.commit(user, {} as never)).rejects.toBeInstanceOf(DomainException);
    await expect(controller.detail(user, 'i')).rejects.toBeInstanceOf(DomainException);
    await expect(controller.discard(user, 'i')).rejects.toBeInstanceOf(DomainException);
  });
});
