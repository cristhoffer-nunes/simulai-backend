import { PERMISSIONS_KEY } from '@/modules/identity/presentation/decorators/require-permissions.decorator';
import { IFlashcardStore } from '@/modules/flashcards/application/ports/flashcard-store.port';
import {
  GetDeckCardsUseCase,
  GetDecksUseCase,
  SetCardStatusUseCase,
} from '@/modules/flashcards/application/use-cases/flashcards.use-cases';
import { PrismaFlashcardStore } from '@/modules/flashcards/infrastructure/prisma-flashcard-store';
import { FlashcardsController } from '@/modules/flashcards/presentation/flashcards.controller';
import { DomainException } from '@/shared/errors/domain.exception';

const user = { sub: 'u1' } as never;

function prismaMock() {
  return {
    question: { findMany: jest.fn(), count: jest.fn() },
    flashcardProgress: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    questionCollection: { findMany: jest.fn(), findFirst: jest.fn() },
    subject: { findFirst: jest.fn() },
  };
}

describe('PrismaFlashcardStore', () => {
  it('counts known and learning cards per deck, ignoring archived questions', async () => {
    const prisma = prismaMock();
    prisma.question.findMany.mockResolvedValue([
      { id: 'q1', subjectId: 's2', subject: { name: 'Cardiologia' } },
      { id: 'q2', subjectId: 's1', subject: { name: 'Anatomia' } },
      { id: 'q3', subjectId: 's1', subject: { name: 'Anatomia' } },
    ]);
    prisma.flashcardProgress.findMany.mockResolvedValue([
      { questionId: 'q1', status: 'known' },
      { questionId: 'q2', status: 'learning' },
      { questionId: 'archived', status: 'known' },
    ]);
    prisma.questionCollection.findMany.mockResolvedValue([
      { id: 'c2', name: 'Vazia', questions: [] },
      {
        id: 'c1',
        name: 'Para revisar',
        questions: [{ questionId: 'q1' }, { questionId: 'archived' }],
      },
    ]);
    const decks = await new PrismaFlashcardStore(prisma as never).decks('u1');
    expect(decks).toEqual([
      { kind: 'all', id: null, name: 'Todas as questões', total: 3, known: 1, learning: 1 },
      { kind: 'subject', id: 's1', name: 'Anatomia', total: 2, known: 0, learning: 1 },
      { kind: 'subject', id: 's2', name: 'Cardiologia', total: 1, known: 1, learning: 0 },
      { kind: 'collection', id: 'c1', name: 'Para revisar', total: 1, known: 1, learning: 0 },
      { kind: 'collection', id: 'c2', name: 'Vazia', total: 0, known: 0, learning: 0 },
    ]);
    expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({
      ownerUserId: 'u1',
      status: 'active',
    });
  });

  it('lists the cards of a deck with the key and the status', async () => {
    const prisma = prismaMock();
    const row = {
      id: 'q1',
      statement: 'Pergunta?',
      explanation: 'Porque.',
      sourceReference: 'p. 4',
      difficulty: 'easy',
      options: [
        { optionKey: 'A', text: 'um', isCorrect: false },
        { optionKey: 'B', text: 'dois', isCorrect: true },
      ],
      subject: { name: 'Anatomia' },
      topic: null,
      flashcards: [{ status: 'learning' }],
    };
    prisma.question.findMany.mockResolvedValue([
      row,
      { ...row, id: 'q2', topic: { name: 'Tórax' }, flashcards: [], options: [] },
    ]);
    const store = new PrismaFlashcardStore(prisma as never);

    const all = await store.cards('u1', { kind: 'all' });
    expect(all!.name).toBe('Todas as questões');
    expect(all!.cards[0]).toEqual({
      questionId: 'q1',
      statement: 'Pergunta?',
      options: [
        { id: 'A', text: 'um' },
        { id: 'B', text: 'dois' },
      ],
      correctOptionId: 'B',
      explanation: 'Porque.',
      sourceReference: 'p. 4',
      subjectName: 'Anatomia',
      topicName: null,
      difficulty: 'easy',
      status: 'learning',
    });
    expect(all!.cards[1]).toEqual(
      expect.objectContaining({ status: 'new', topicName: 'Tórax', correctOptionId: '' }),
    );

    prisma.subject.findFirst
      .mockResolvedValueOnce({ name: 'Anatomia' })
      .mockResolvedValueOnce(null);
    expect((await store.cards('u1', { kind: 'subject', id: 's1' }))!.name).toBe('Anatomia');
    expect(prisma.question.findMany.mock.calls[1][0].where).toEqual({
      ownerUserId: 'u1',
      status: 'active',
      subjectId: 's1',
    });
    expect(await store.cards('u1', { kind: 'subject', id: 'nope' })).toBeNull();

    prisma.questionCollection.findFirst
      .mockResolvedValueOnce({ name: 'Para revisar' })
      .mockResolvedValueOnce(null);
    expect((await store.cards('u1', { kind: 'collection', id: 'c1' }))!.name).toBe('Para revisar');
    expect(prisma.question.findMany.mock.calls[2][0].where.collections).toEqual({
      some: { collectionId: 'c1' },
    });
    expect(await store.cards('u1', { kind: 'collection', id: 'other' })).toBeNull();
  });

  it('stores, clears and refuses statuses', async () => {
    const prisma = prismaMock();
    const store = new PrismaFlashcardStore(prisma as never);
    prisma.question.count.mockResolvedValue(1);
    expect(await store.setStatus('u1', 'q1', 'known')).toBe(true);
    expect(prisma.flashcardProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_questionId: { userId: 'u1', questionId: 'q1' } },
        create: { userId: 'u1', questionId: 'q1', status: 'known' },
      }),
    );
    expect(await store.setStatus('u1', 'q1', 'new')).toBe(true);
    expect(prisma.flashcardProgress.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', questionId: 'q1' },
    });
    prisma.question.count.mockResolvedValue(0);
    expect(await store.setStatus('u1', 'q9', 'known')).toBe(false);
  });
});

describe('Flashcards use cases and controller', () => {
  function setup() {
    const store: jest.Mocked<IFlashcardStore> = {
      decks: jest.fn().mockResolvedValue([]),
      cards: jest.fn().mockResolvedValue({ name: 'Anatomia', cards: [] }),
      setStatus: jest.fn().mockResolvedValue(true),
    };
    const controller = new FlashcardsController(
      new GetDecksUseCase(store),
      new GetDeckCardsUseCase(store),
      new SetCardStatusUseCase(store),
    );
    return { store, controller };
  }

  it('needs study access', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, FlashcardsController)).toEqual(['study.access']);
  });

  it('serves decks, cards and status changes', async () => {
    const { store, controller } = setup();
    expect(await controller.decks(user)).toEqual({ decks: [] });
    expect(await controller.cards(user, {})).toEqual({
      deck: { kind: 'all', id: null, name: 'Anatomia' },
      cards: [],
    });
    await controller.cards(user, { subjectId: 's1' });
    expect(store.cards).toHaveBeenLastCalledWith('u1', { kind: 'subject', id: 's1' });
    expect((await controller.cards(user, { collectionId: 'c1' })).deck).toEqual({
      kind: 'collection',
      id: 'c1',
      name: 'Anatomia',
    });
    expect(await controller.status(user, 'q1', { status: 'known' })).toEqual({
      questionId: 'q1',
      status: 'known',
    });
    expect(store.setStatus).toHaveBeenCalledWith('u1', 'q1', 'known');
  });

  it('maps errors: both filters, unknown deck, foreign question', async () => {
    const { store, controller } = setup();
    await expect(
      controller.cards(user, { subjectId: 's', collectionId: 'c' }),
    ).rejects.toBeInstanceOf(DomainException);
    store.cards.mockResolvedValueOnce(null);
    await expect(controller.cards(user, { collectionId: 'x' })).rejects.toBeInstanceOf(
      DomainException,
    );
    store.setStatus.mockResolvedValueOnce(false);
    await expect(controller.status(user, 'q9', { status: 'learning' })).rejects.toBeInstanceOf(
      DomainException,
    );
  });
});
