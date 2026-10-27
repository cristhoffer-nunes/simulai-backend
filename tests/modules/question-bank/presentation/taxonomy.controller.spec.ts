import { AppError } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { Result } from '@/shared/result/result';
import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { TaxonomyController } from '@/modules/question-bank/presentation/controllers/taxonomy.controller';

const user = { sub: 'u1' } as never;
const ok = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(Result.ok(value)) });
const fail = () => ({
  execute: jest.fn().mockResolvedValue(Result.fail(AppError.validation('x'))),
});

describe('TaxonomyController', () => {
  it('is restricted to students (study.access)', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, TaxonomyController)).toEqual(['study.access']);
  });

  it('returns the tree and sets 201/200 depending on whether the entry was created', async () => {
    const reply = { status: jest.fn() };
    const controller = new TaxonomyController(
      ok({ areas: [] }) as never,
      ok({ id: 's', created: true }) as never,
      ok({ id: 't', created: false }) as never,
    );
    await expect(controller.tree(user)).resolves.toEqual({ areas: [] });
    await controller.addSubject(user, { knowledgeAreaId: 'a', name: 'X' }, reply as never);
    expect(reply.status).toHaveBeenLastCalledWith(201);
    await controller.addTopic(user, 's', { name: 'Y' }, reply as never);
    expect(reply.status).toHaveBeenLastCalledWith(200);
  });

  it('maps failures', async () => {
    const reply = { status: jest.fn() };
    const controller = new TaxonomyController(fail() as never, fail() as never, fail() as never);
    await expect(controller.tree(user)).rejects.toBeInstanceOf(DomainException);
    await expect(
      controller.addSubject(user, { knowledgeAreaId: 'a', name: 'X' }, reply as never),
    ).rejects.toBeInstanceOf(DomainException);
    await expect(
      controller.addTopic(user, 's', { name: 'Y' }, reply as never),
    ).rejects.toBeInstanceOf(DomainException);
  });
});
