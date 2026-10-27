import { CreateSubjectUseCase } from '@/modules/question-bank/application/use-cases/create-subject.use-case';
import { CreateTopicUseCase } from '@/modules/question-bank/application/use-cases/create-topic.use-case';
import { GetTaxonomyUseCase } from '@/modules/question-bank/application/use-cases/get-taxonomy.use-case';
import { Subject } from '@/modules/question-bank/domain/taxonomy/subject.entity';
import { ITaxonomyRepository } from '@/modules/question-bank/domain/taxonomy/taxonomy.repository';

function fakeTaxonomy(overrides: Partial<jest.Mocked<ITaxonomyRepository>> = {}) {
  return {
    treeFor: jest.fn().mockResolvedValue([]),
    areaExists: jest.fn().mockResolvedValue(true),
    findVisibleSubject: jest.fn().mockResolvedValue(null),
    findVisibleSubjectByName: jest.fn().mockResolvedValue(null),
    createSubject: jest.fn(),
    addTopic: jest.fn(),
    ...overrides,
  } as jest.Mocked<ITaxonomyRepository>;
}

const anatomy = () =>
  Subject.reconstitute({
    id: 's1',
    knowledgeAreaId: 'a1',
    ownerUserId: null,
    name: 'Anatomia',
    topics: [{ id: 't1', subjectId: 's1', ownerUserId: null, name: 'Tórax' }],
  });

describe('taxonomy use cases', () => {
  it('returns the tree for the student', async () => {
    const repo = fakeTaxonomy({ treeFor: jest.fn().mockResolvedValue([{ id: 'a1' }]) });
    const result = await new GetTaxonomyUseCase(repo).execute('u1');
    expect(result.value).toEqual({ areas: [{ id: 'a1' }] });
    expect(repo.treeFor).toHaveBeenCalledWith('u1');
  });

  describe('CreateSubjectUseCase', () => {
    it('creates a private subject', async () => {
      const repo = fakeTaxonomy();
      const result = await new CreateSubjectUseCase(repo).execute({
        userId: 'u1',
        knowledgeAreaId: 'a1',
        name: ' Pediatria ',
      });
      expect(result.value).toEqual(
        expect.objectContaining({ name: 'Pediatria', custom: true, created: true }),
      );
      expect(repo.createSubject).toHaveBeenCalled();
    });

    it('reuses a visible subject with the same name', async () => {
      const repo = fakeTaxonomy({
        findVisibleSubjectByName: jest.fn().mockResolvedValue(anatomy()),
      });
      const result = await new CreateSubjectUseCase(repo).execute({
        userId: 'u1',
        knowledgeAreaId: 'a1',
        name: 'anatomia',
      });
      expect(result.value).toEqual({ id: 's1', name: 'Anatomia', custom: false, created: false });
      expect(repo.createSubject).not.toHaveBeenCalled();
    });

    it('rejects invalid names and unknown areas', async () => {
      const invalid = await new CreateSubjectUseCase(fakeTaxonomy()).execute({
        userId: 'u1',
        knowledgeAreaId: 'a1',
        name: ' ',
      });
      expect(invalid.error.kind).toBe('VALIDATION_ERROR');

      const missing = await new CreateSubjectUseCase(
        fakeTaxonomy({ areaExists: jest.fn().mockResolvedValue(false) }),
      ).execute({ userId: 'u1', knowledgeAreaId: 'x', name: 'Nova' });
      expect(missing.error.kind).toBe('NOT_FOUND');
    });
  });

  describe('CreateTopicUseCase', () => {
    it('creates a private topic under a visible subject', async () => {
      const repo = fakeTaxonomy({ findVisibleSubject: jest.fn().mockResolvedValue(anatomy()) });
      const result = await new CreateTopicUseCase(repo).execute({
        userId: 'u1',
        subjectId: 's1',
        name: 'Abdome',
      });
      expect(result.value).toEqual(expect.objectContaining({ name: 'Abdome', created: true }));
      expect(repo.addTopic).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId: 's1', ownerUserId: 'u1' }),
      );
    });

    it('reuses a same-name topic', async () => {
      const repo = fakeTaxonomy({ findVisibleSubject: jest.fn().mockResolvedValue(anatomy()) });
      const result = await new CreateTopicUseCase(repo).execute({
        userId: 'u1',
        subjectId: 's1',
        name: 'TORAX',
      });
      expect(result.value).toEqual({ id: 't1', name: 'Tórax', custom: false, created: false });
    });

    it("hides other people's subjects and rejects bad names", async () => {
      const missing = await new CreateTopicUseCase(fakeTaxonomy()).execute({
        userId: 'u1',
        subjectId: 'other',
        name: 'X',
      });
      expect(missing.error.kind).toBe('NOT_FOUND');
      const invalid = await new CreateTopicUseCase(fakeTaxonomy()).execute({
        userId: 'u1',
        subjectId: 's1',
        name: '',
      });
      expect(invalid.error.kind).toBe('VALIDATION_ERROR');
    });
  });
});
