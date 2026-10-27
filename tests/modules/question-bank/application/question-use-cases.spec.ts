import { decodeCursor, encodeCursor } from '@/modules/question-bank/application/cursor';
import { ArchiveQuestionUseCase } from '@/modules/question-bank/application/use-cases/archive-question.use-case';
import { CreateQuestionUseCase } from '@/modules/question-bank/application/use-cases/create-question.use-case';
import { GetQuestionUseCase } from '@/modules/question-bank/application/use-cases/get-question.use-case';
import { ListQuestionsUseCase } from '@/modules/question-bank/application/use-cases/list-questions.use-case';
import { UpdateQuestionUseCase } from '@/modules/question-bank/application/use-cases/update-question.use-case';
import { buildQuestion, detail, fakeQuestions, fakeTaxonomy, optionsInput } from '../helpers';

const newQuestion = {
  userId: 'u1',
  subjectId: 's1',
  topicId: 't1',
  statement: 'Qual valva?',
  explanation: 'Tricúspide.',
  difficulty: 'easy',
  options: optionsInput,
};

describe('cursor', () => {
  it('round-trips and rejects garbage', () => {
    const position = { createdAt: new Date('2026-10-01T10:00:00Z'), id: 'q1' };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
    const bad = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    for (const cursor of [
      '%%%',
      bad({}),
      bad([1, 'x']),
      bad(['not-a-date', 'x']),
      bad(['2026-01-01']),
    ]) {
      expect(decodeCursor(cursor)).toBeNull();
    }
  });
});

describe('CreateQuestionUseCase', () => {
  it('creates a question owned by the student', async () => {
    const questions = fakeQuestions();
    const result = await new CreateQuestionUseCase(questions, fakeTaxonomy()).execute(newQuestion);

    expect(result.isSuccess).toBe(true);
    const created = questions.create.mock.calls[0]![0];
    expect(created.ownerUserId).toBe('u1');
    expect([created.subjectId, created.topicId]).toEqual(['s1', 't1']);
    expect(questions.detail).toHaveBeenCalledWith('u1', created.id);
  });

  it('collects content and classification errors together', async () => {
    const questions = fakeQuestions();
    const result = await new CreateQuestionUseCase(questions, fakeTaxonomy()).execute({
      ...newQuestion,
      subjectId: 'someone-elses',
      statement: '',
    });
    expect(result.error.kind).toBe('VALIDATION_ERROR');
    expect((result.error.details as { path: string }[]).map((error) => error.path)).toEqual([
      'statement',
      'subjectId',
    ]);
    expect(questions.create).not.toHaveBeenCalled();
  });

  it('rejects a topic from another subject', async () => {
    const result = await new CreateQuestionUseCase(fakeQuestions(), fakeTaxonomy()).execute({
      ...newQuestion,
      subjectId: 's2',
      topicId: 't1',
    });
    expect(result.error.details).toEqual([
      expect.objectContaining({ code: 'TOPIC_NOT_IN_SUBJECT' }),
    ]);
  });

  it('accepts a question without topic', async () => {
    const questions = fakeQuestions();
    await new CreateQuestionUseCase(questions, fakeTaxonomy()).execute({
      ...newQuestion,
      topicId: undefined,
    });
    expect(questions.create.mock.calls[0]![0].topicId).toBeNull();
  });
});

describe('GetQuestionUseCase', () => {
  it('returns own questions and hides others as 404', async () => {
    const questions = fakeQuestions();
    expect((await new GetQuestionUseCase(questions).execute('u1', 'q1')).value.id).toBe('q1');
    questions.detail.mockResolvedValue(null);
    expect((await new GetQuestionUseCase(questions).execute('u1', 'q2')).error.kind).toBe(
      'NOT_FOUND',
    );
  });
});

describe('ListQuestionsUseCase', () => {
  it('defaults to active questions, caps the limit and returns the next cursor', async () => {
    const item = detail({ id: 'q9', createdAt: new Date('2026-10-02T00:00:00Z') });
    const questions = fakeQuestions({
      list: jest.fn().mockResolvedValue({ items: [item], total: 41, hasMore: true }),
    });
    const result = await new ListQuestionsUseCase(questions).execute({
      userId: 'u1',
      limit: 500,
      q: '  ',
    });

    expect(questions.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 'u1',
        status: 'active',
        limit: 100,
        search: undefined,
        after: undefined,
      }),
    );
    expect(result.value.total).toBe(41);
    expect(decodeCursor(result.value.nextCursor!)).toEqual({ createdAt: item.createdAt, id: 'q9' });
  });

  it('continues from a cursor and ends with null', async () => {
    const questions = fakeQuestions();
    const cursor = encodeCursor({ createdAt: new Date('2026-10-01T00:00:00Z'), id: 'q1' });
    const result = await new ListQuestionsUseCase(questions).execute({
      userId: 'u1',
      cursor,
      status: 'archived',
      difficulty: 'hard',
      q: ' valva ',
    });
    expect(questions.list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'archived',
        difficulty: 'hard',
        search: 'valva',
        limit: 20,
        after: { createdAt: new Date('2026-10-01T00:00:00Z'), id: 'q1' },
      }),
    );
    expect(result.value.nextCursor).toBeNull();
  });

  it('rejects a tampered cursor', async () => {
    const result = await new ListQuestionsUseCase(fakeQuestions()).execute({
      userId: 'u1',
      cursor: 'abc',
    });
    expect(result.error.kind).toBe('VALIDATION_ERROR');
  });
});

describe('UpdateQuestionUseCase', () => {
  function build(question = buildQuestion()) {
    const questions = fakeQuestions({ findOwned: jest.fn().mockResolvedValue(question) });
    return { question, questions, useCase: new UpdateQuestionUseCase(questions, fakeTaxonomy()) };
  }

  it('merges partial content with the current one', async () => {
    const { question, questions, useCase } = build();
    await useCase.execute({ userId: 'u1', questionId: 'q1', statement: 'Nova pergunta?' });
    expect(question.content.statement).toBe('Nova pergunta?');
    expect(question.content.options).toHaveLength(2);
    expect(questions.save).toHaveBeenCalledWith(question);
  });

  it('replaces options and difficulty', async () => {
    const { question, useCase } = build();
    await useCase.execute({
      userId: 'u1',
      questionId: 'q1',
      difficulty: 'hard',
      options: [...optionsInput, { text: 'Pulmonar', isCorrect: false }],
    });
    expect(question.content.difficulty).toBe('hard');
    expect(question.content.options.map((option) => option.key)).toEqual(['A', 'B', 'C']);
  });

  it('moving to another subject drops a topic that does not belong to it', async () => {
    const { question, useCase } = build();
    await useCase.execute({ userId: 'u1', questionId: 'q1', subjectId: 's2' });
    expect([question.subjectId, question.topicId]).toEqual(['s2', null]);
  });

  it('keeps the topic when the subject stays, and can clear it', async () => {
    const { question, useCase } = build();
    await useCase.execute({ userId: 'u1', questionId: 'q1', subjectId: 's1' });
    expect(question.topicId).toBe('t1');
    await useCase.execute({ userId: 'u1', questionId: 'q1', topicId: null });
    expect(question.topicId).toBeNull();
  });

  it('archives and restores', async () => {
    const { question, useCase } = build();
    await useCase.execute({ userId: 'u1', questionId: 'q1', status: 'archived' });
    expect(question.status).toBe('archived');
    await useCase.execute({ userId: 'u1', questionId: 'q1', status: 'active' });
    expect(question.status).toBe('active');
  });

  it('returns field errors without saving', async () => {
    const { questions, useCase } = build();
    const result = await useCase.execute({
      userId: 'u1',
      questionId: 'q1',
      options: [{ text: 'Só uma', isCorrect: true }],
      topicId: 'unknown-topic',
    });
    expect((result.error.details as { code: string }[]).map((error) => error.code)).toEqual([
      'OPTIONS_COUNT',
      'TOPIC_NOT_IN_SUBJECT',
    ]);
    expect(questions.save).not.toHaveBeenCalled();
  });

  it("404 for questions that are not the student's", async () => {
    const questions = fakeQuestions();
    const result = await new UpdateQuestionUseCase(questions, fakeTaxonomy()).execute({
      userId: 'u1',
      questionId: 'x',
    });
    expect(result.error.kind).toBe('NOT_FOUND');
  });
});

describe('ArchiveQuestionUseCase', () => {
  it('archives own questions and 404s others', async () => {
    const question = buildQuestion();
    const questions = fakeQuestions({
      findOwned: jest.fn().mockResolvedValueOnce(question).mockResolvedValueOnce(null),
    });
    const useCase = new ArchiveQuestionUseCase(questions);
    expect((await useCase.execute('u1', 'q1')).isSuccess).toBe(true);
    expect(question.status).toBe('archived');
    expect((await useCase.execute('u1', 'x')).error.kind).toBe('NOT_FOUND');
  });
});
