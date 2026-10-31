import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  DeckRef,
  DeckSummary,
  FlashcardStatus,
  FlashcardView,
  IFlashcardStore,
} from '../application/ports/flashcard-store.port';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

@Injectable()
export class PrismaFlashcardStore implements IFlashcardStore {
  constructor(private readonly prisma: PrismaService) {}

  async decks(ownerUserId: string): Promise<DeckSummary[]> {
    // A student's bank holds hundreds of questions: three small reads, counted here.
    const [questions, progress, collections] = await Promise.all([
      this.prisma.question.findMany({
        where: { ownerUserId, status: 'active' },
        select: { id: true, subjectId: true, subject: { select: { name: true } } },
      }),
      this.prisma.flashcardProgress.findMany({
        where: { userId: ownerUserId },
        select: { questionId: true, status: true },
      }),
      this.prisma.questionCollection.findMany({
        where: { ownerUserId },
        select: { id: true, name: true, questions: { select: { questionId: true } } },
      }),
    ]);
    const statusOf = new Map(progress.map((row) => [row.questionId, row.status]));
    const summarize = (ids: string[]) => ({
      total: ids.length,
      known: ids.filter((id) => statusOf.get(id) === 'known').length,
      learning: ids.filter((id) => statusOf.get(id) === 'learning').length,
    });

    const active = new Set(questions.map((question) => question.id));
    const subjects = new Map<string, { name: string; ids: string[] }>();
    for (const question of questions) {
      const entry = subjects.get(question.subjectId) ?? { name: question.subject.name, ids: [] };
      entry.ids.push(question.id);
      subjects.set(question.subjectId, entry);
    }
    return [
      { kind: 'all', id: null, name: 'Todas as questões', ...summarize([...active]) },
      ...[...subjects]
        .map(([id, { name, ids }]) => ({ kind: 'subject' as const, id, name, ...summarize(ids) }))
        .sort(byName),
      ...collections
        .map((collection) => ({
          kind: 'collection' as const,
          id: collection.id,
          name: collection.name,
          ...summarize(
            collection.questions.map((member) => member.questionId).filter((id) => active.has(id)),
          ),
        }))
        .sort(byName),
    ];
  }

  async cards(
    ownerUserId: string,
    deck: DeckRef,
  ): Promise<{ name: string; cards: FlashcardView[] } | null> {
    let name = 'Todas as questões';
    const where: Prisma.QuestionWhereInput = { ownerUserId, status: 'active' };
    if (deck.kind === 'subject') {
      const subject = await this.prisma.subject.findFirst({
        where: { id: deck.id, OR: [{ ownerUserId }, { ownerUserId: null }] },
        select: { name: true },
      });
      if (!subject) return null;
      name = subject.name;
      where.subjectId = deck.id;
    } else if (deck.kind === 'collection') {
      const collection = await this.prisma.questionCollection.findFirst({
        where: { id: deck.id, ownerUserId },
        select: { name: true },
      });
      if (!collection) return null;
      name = collection.name;
      where.collections = { some: { collectionId: deck.id } };
    }

    const rows = await this.prisma.question.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        options: { orderBy: { optionKey: 'asc' } },
        subject: { select: { name: true } },
        topic: { select: { name: true } },
        flashcards: { where: { userId: ownerUserId }, select: { status: true } },
      },
    });
    return {
      name,
      cards: rows.map((row) => ({
        questionId: row.id,
        statement: row.statement,
        options: row.options.map((option) => ({ id: option.optionKey, text: option.text })),
        correctOptionId: row.options.find((option) => option.isCorrect)?.optionKey ?? '',
        explanation: row.explanation,
        sourceReference: row.sourceReference,
        subjectName: row.subject.name,
        topicName: row.topic?.name ?? null,
        difficulty: row.difficulty,
        status: (row.flashcards[0]?.status as FlashcardStatus | undefined) ?? 'new',
      })),
    };
  }

  async setStatus(
    ownerUserId: string,
    questionId: string,
    status: FlashcardStatus,
  ): Promise<boolean> {
    const owned = await this.prisma.question.count({ where: { id: questionId, ownerUserId } });
    if (owned === 0) return false;
    const key = { userId_questionId: { userId: ownerUserId, questionId } };
    if (status === 'new') {
      await this.prisma.flashcardProgress.deleteMany({
        where: { userId: ownerUserId, questionId },
      });
    } else {
      await this.prisma.flashcardProgress.upsert({
        where: key,
        create: { userId: ownerUserId, questionId, status },
        update: { status, updatedAt: new Date() },
      });
    }
    return true;
  }
}
