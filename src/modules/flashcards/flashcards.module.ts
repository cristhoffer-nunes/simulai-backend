import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FLASHCARD_STORE } from './application/ports/flashcard-store.port';
import {
  GET_DECK_CARDS_USE_CASE,
  GET_DECKS_USE_CASE,
  GetDeckCardsUseCase,
  GetDecksUseCase,
  SET_CARD_STATUS_USE_CASE,
  SetCardStatusUseCase,
} from './application/use-cases/flashcards.use-cases';
import { PrismaFlashcardStore } from './infrastructure/prisma-flashcard-store';
import { FlashcardsController } from './presentation/flashcards.controller';

/** Flashcards: every active bank question is a card; the student sorts them into two piles. */
@Module({
  imports: [IdentityModule],
  controllers: [FlashcardsController],
  providers: [
    { provide: FLASHCARD_STORE, useClass: PrismaFlashcardStore },
    { provide: GET_DECKS_USE_CASE, useClass: GetDecksUseCase },
    { provide: GET_DECK_CARDS_USE_CASE, useClass: GetDeckCardsUseCase },
    { provide: SET_CARD_STATUS_USE_CASE, useClass: SetCardStatusUseCase },
  ],
})
export class FlashcardsModule {}
