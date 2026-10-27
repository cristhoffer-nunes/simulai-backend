import { AddQuestionsToCollectionUseCase } from '@/modules/question-bank/application/use-cases/add-questions-to-collection.use-case';
import { CreateCollectionUseCase } from '@/modules/question-bank/application/use-cases/create-collection.use-case';
import { DeleteCollectionUseCase } from '@/modules/question-bank/application/use-cases/delete-collection.use-case';
import { GetCollectionUseCase } from '@/modules/question-bank/application/use-cases/get-collection.use-case';
import { ListCollectionsUseCase } from '@/modules/question-bank/application/use-cases/list-collections.use-case';
import { RemoveQuestionFromCollectionUseCase } from '@/modules/question-bank/application/use-cases/remove-question-from-collection.use-case';
import { UpdateCollectionUseCase } from '@/modules/question-bank/application/use-cases/update-collection.use-case';
import { Collection } from '@/modules/question-bank/domain/collections/collection.entity';
import { fakeCollections, fakeQuestions } from '../helpers';

const owned = () =>
  Collection.reconstitute({
    id: 'c1',
    ownerUserId: 'u1',
    name: 'Revisão R1',
    description: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  });

const summary = (id: string, name: string) => ({
  id,
  name,
  description: null,
  questionCount: 3,
  createdAt: new Date(),
});

describe('collection use cases', () => {
  it("lists and gets the student's collections (404 for others)", async () => {
    const collections = fakeCollections({
      listByOwner: jest.fn().mockResolvedValue([summary('c1', 'A')]),
    });
    expect((await new ListCollectionsUseCase(collections).execute('u1')).value.items).toHaveLength(
      1,
    );

    const get = new GetCollectionUseCase(collections);
    expect((await get.execute('u1', 'c1')).value.id).toBe('c1');
    collections.summary.mockResolvedValue(null);
    expect((await get.execute('u1', 'cx')).error.kind).toBe('NOT_FOUND');
  });

  describe('CreateCollectionUseCase', () => {
    it('creates with normalized name and description', async () => {
      const collections = fakeCollections();
      const result = await new CreateCollectionUseCase(collections).execute({
        userId: 'u1',
        name: '  Para   revisar ',
        description: '  ',
      });
      expect(result.value).toEqual(
        expect.objectContaining({ name: 'Para revisar', description: null, questionCount: 0 }),
      );
      expect(collections.create).toHaveBeenCalled();
    });

    it('rejects names already used (case and accents ignored) with 409', async () => {
      const collections = fakeCollections({
        listByOwner: jest.fn().mockResolvedValue([summary('c1', 'Revisão')]),
      });
      const result = await new CreateCollectionUseCase(collections).execute({
        userId: 'u1',
        name: 'REVISAO',
      });
      expect(result.error.kind).toBe('CONFLICT');
    });

    it('reports invalid fields', async () => {
      const result = await new CreateCollectionUseCase(fakeCollections()).execute({
        userId: 'u1',
        name: '',
        description: 'x'.repeat(501),
      });
      expect((result.error.details as { path: string }[]).map((error) => error.path)).toEqual([
        'name',
        'description',
      ]);
    });
  });

  describe('UpdateCollectionUseCase', () => {
    it('renames and redescribes', async () => {
      const collection = owned();
      const collections = fakeCollections({
        findOwned: jest.fn().mockResolvedValue(collection),
        listByOwner: jest.fn().mockResolvedValue([summary('c1', 'Revisão R1')]),
      });
      const result = await new UpdateCollectionUseCase(collections).execute({
        userId: 'u1',
        collectionId: 'c1',
        name: 'revisão r1',
        description: 'Cardio',
      });
      expect(result.isSuccess).toBe(true);
      expect([collection.name, collection.description]).toEqual(['revisão r1', 'Cardio']);
      expect(collections.save).toHaveBeenCalledWith(collection);
    });

    it("409 on another collection's name, 400 on bad fields, 404 for others", async () => {
      const collections = fakeCollections({
        findOwned: jest.fn().mockResolvedValue(owned()),
        listByOwner: jest
          .fn()
          .mockResolvedValue([summary('c1', 'Revisão R1'), summary('c2', 'Outra')]),
      });
      const useCase = new UpdateCollectionUseCase(collections);
      expect(
        (await useCase.execute({ userId: 'u1', collectionId: 'c1', name: 'outra' })).error.kind,
      ).toBe('CONFLICT');
      expect(
        (await useCase.execute({ userId: 'u1', collectionId: 'c1', name: ' ' })).error.kind,
      ).toBe('VALIDATION_ERROR');
      expect(
        (await useCase.execute({ userId: 'u1', collectionId: 'c1', description: 'x'.repeat(600) }))
          .error.kind,
      ).toBe('VALIDATION_ERROR');
      collections.findOwned.mockResolvedValue(null);
      expect((await useCase.execute({ userId: 'u1', collectionId: 'cx' })).error.kind).toBe(
        'NOT_FOUND',
      );
    });
  });

  it('deletes only own collections', async () => {
    const collections = fakeCollections({
      findOwned: jest.fn().mockResolvedValueOnce(owned()).mockResolvedValueOnce(null),
    });
    const useCase = new DeleteCollectionUseCase(collections);
    expect((await useCase.execute('u1', 'c1')).isSuccess).toBe(true);
    expect(collections.delete).toHaveBeenCalledWith('c1');
    expect((await useCase.execute('u1', 'cx')).error.kind).toBe('NOT_FOUND');
  });

  describe('AddQuestionsToCollectionUseCase', () => {
    it("adds the student's questions, deduplicated", async () => {
      const collections = fakeCollections({ findOwned: jest.fn().mockResolvedValue(owned()) });
      const questions = fakeQuestions({
        ownedIds: jest.fn(async (_u: string, ids: string[]) => ids),
      });
      const result = await new AddQuestionsToCollectionUseCase(collections, questions).execute({
        userId: 'u1',
        collectionId: 'c1',
        questionIds: ['q1', 'q2', 'q1'],
      });
      expect(result.value).toEqual({ added: 2 });
      expect(collections.addQuestions).toHaveBeenCalledWith('c1', ['q1', 'q2']);
    });

    it('refuses questions or collections of someone else', async () => {
      const questions = fakeQuestions({ ownedIds: jest.fn().mockResolvedValue(['q1']) });
      const collections = fakeCollections({ findOwned: jest.fn().mockResolvedValue(owned()) });
      const foreignQuestion = await new AddQuestionsToCollectionUseCase(
        collections,
        questions,
      ).execute({
        userId: 'u1',
        collectionId: 'c1',
        questionIds: ['q1', 'q-other'],
      });
      expect(foreignQuestion.error.kind).toBe('NOT_FOUND');
      expect(collections.addQuestions).not.toHaveBeenCalled();

      const foreignCollection = await new AddQuestionsToCollectionUseCase(
        fakeCollections(),
        questions,
      ).execute({
        userId: 'u1',
        collectionId: 'cx',
        questionIds: ['q1'],
      });
      expect(foreignCollection.error.kind).toBe('NOT_FOUND');
    });
  });

  it('removes a question from an own collection', async () => {
    const collections = fakeCollections({
      findOwned: jest.fn().mockResolvedValueOnce(owned()).mockResolvedValueOnce(null),
    });
    const useCase = new RemoveQuestionFromCollectionUseCase(collections);
    expect((await useCase.execute('u1', 'c1', 'q1')).isSuccess).toBe(true);
    expect(collections.removeQuestion).toHaveBeenCalledWith('c1', 'q1');
    expect((await useCase.execute('u1', 'cx', 'q1')).error.kind).toBe('NOT_FOUND');
  });
});
