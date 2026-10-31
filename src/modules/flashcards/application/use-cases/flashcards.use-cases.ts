import { Inject, Injectable } from '@nestjs/common';
import { AppError, ResourceErrors } from '../../../../shared/errors/app-error';
import { Result } from '../../../../shared/result/result';
import {
  DeckRef,
  DeckSummary,
  FLASHCARD_STORE,
  FlashcardStatus,
  FlashcardView,
  IFlashcardStore,
} from '../ports/flashcard-store.port';

export const GET_DECKS_USE_CASE = Symbol('GET_DECKS_USE_CASE');
export const GET_DECK_CARDS_USE_CASE = Symbol('GET_DECK_CARDS_USE_CASE');
export const SET_CARD_STATUS_USE_CASE = Symbol('SET_CARD_STATUS_USE_CASE');

export interface DeckCards {
  deck: { kind: DeckRef['kind']; id: string | null; name: string };
  cards: FlashcardView[];
}

/** The decks page: the whole bank, each subject and each collection, with progress. */
@Injectable()
export class GetDecksUseCase {
  constructor(@Inject(FLASHCARD_STORE) private readonly store: IFlashcardStore) {}

  async execute(userId: string): Promise<Result<{ decks: DeckSummary[] }, AppError>> {
    return Result.ok({ decks: await this.store.decks(userId) });
  }
}

/** Cards of one deck, to study. 404 for a subject or collection that is not the student's. */
@Injectable()
export class GetDeckCardsUseCase {
  constructor(@Inject(FLASHCARD_STORE) private readonly store: IFlashcardStore) {}

  async execute(userId: string, deck: DeckRef): Promise<Result<DeckCards, AppError>> {
    const found = await this.store.cards(userId, deck);
    if (!found) return Result.fail(ResourceErrors.notFound('Deck'));
    return Result.ok({
      deck: { kind: deck.kind, id: deck.kind === 'all' ? null : deck.id, name: found.name },
      cards: found.cards,
    });
  }
}

/** "Já sei" / "Ainda aprendendo" (or "new" to undo the first sort of a card). Idempotent. */
@Injectable()
export class SetCardStatusUseCase {
  constructor(@Inject(FLASHCARD_STORE) private readonly store: IFlashcardStore) {}

  async execute(
    userId: string,
    questionId: string,
    status: FlashcardStatus,
  ): Promise<Result<{ questionId: string; status: FlashcardStatus }, AppError>> {
    if (!(await this.store.setStatus(userId, questionId, status))) {
      return Result.fail(ResourceErrors.notFound('Question'));
    }
    return Result.ok({ questionId, status });
  }
}
