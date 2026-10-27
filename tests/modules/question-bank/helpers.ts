import { QuestionContent } from '@/modules/question-bank/domain/questions/question-content';
import { Question } from '@/modules/question-bank/domain/questions/question.entity';
import {
  IQuestionRepository,
  QuestionDetail,
} from '@/modules/question-bank/domain/questions/question.repository';
import { Subject } from '@/modules/question-bank/domain/taxonomy/subject.entity';
import { ITaxonomyRepository } from '@/modules/question-bank/domain/taxonomy/taxonomy.repository';

export const content = (overrides: Partial<QuestionContent> = {}): QuestionContent => ({
  statement: 'Qual valva separa o átrio direito do ventrículo direito?',
  explanation: 'A valva tricúspide.',
  difficulty: 'easy',
  options: [
    { key: 'A', text: 'Mitral', isCorrect: false },
    { key: 'B', text: 'Tricúspide', isCorrect: true },
  ],
  ...overrides,
});

export const optionsInput = [
  { text: 'Mitral', isCorrect: false },
  { text: 'Tricúspide', isCorrect: true },
];

export function buildQuestion(
  overrides: Partial<Parameters<typeof Question.reconstitute>[0]> = {},
) {
  return Question.reconstitute({
    id: 'q1',
    ownerUserId: 'u1',
    subjectId: 's1',
    topicId: 't1',
    content: content(),
    status: 'active',
    contentHash: 'h',
    sourceImportId: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  });
}

export const detail = (overrides: Partial<QuestionDetail> = {}): QuestionDetail => ({
  id: 'q1',
  statement: 'S',
  explanation: 'E',
  difficulty: 'easy',
  status: 'active',
  subject: { id: 's1', name: 'Anatomia' },
  topic: null,
  collectionCount: 0,
  collectionIds: [],
  options: [],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
});

export const anatomy = () =>
  Subject.reconstitute({
    id: 's1',
    knowledgeAreaId: 'a1',
    ownerUserId: null,
    name: 'Anatomia',
    topics: [{ id: 't1', subjectId: 's1', ownerUserId: null, name: 'Tórax' }],
  });

export const cardiology = () =>
  Subject.reconstitute({
    id: 's2',
    knowledgeAreaId: 'a1',
    ownerUserId: null,
    name: 'Cardiologia',
    topics: [],
  });

export function fakeTaxonomy(overrides: Partial<jest.Mocked<ITaxonomyRepository>> = {}) {
  return {
    treeFor: jest.fn().mockResolvedValue([]),
    areaExists: jest.fn().mockResolvedValue(true),
    findVisibleSubject: jest.fn(async (_userId: string, id: string) =>
      id === 's1' ? anatomy() : id === 's2' ? cardiology() : null,
    ),
    findVisibleSubjectByName: jest.fn().mockResolvedValue(null),
    createSubject: jest.fn(),
    addTopic: jest.fn(),
    ...overrides,
  } as jest.Mocked<ITaxonomyRepository>;
}

export function fakeQuestions(overrides: Partial<jest.Mocked<IQuestionRepository>> = {}) {
  return {
    findOwned: jest.fn().mockResolvedValue(null),
    detail: jest.fn(async (_u: string, id: string) => detail({ id })),
    list: jest.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
    create: jest.fn(),
    save: jest.fn(),
    ...overrides,
  } as jest.Mocked<IQuestionRepository>;
}
