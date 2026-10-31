import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { AppError } from '../../../shared/errors/app-error';
import { DomainException } from '../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../identity/application/ports/token.port';
import { CurrentUser } from '../../identity/presentation/decorators/current-user.decorator';
import { StudyAccess } from '../../question-bank/presentation/study-access';
import { DeckRef } from '../application/ports/flashcard-store.port';
import {
  GET_DECK_CARDS_USE_CASE,
  GET_DECKS_USE_CASE,
  GetDeckCardsUseCase,
  GetDecksUseCase,
  SET_CARD_STATUS_USE_CASE,
  SetCardStatusUseCase,
} from '../application/use-cases/flashcards.use-cases';

export class DeckQueryDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;
}

export class CardStatusDto {
  /** "new" undoes the first sort of a card. */
  @IsIn(['new', 'learning', 'known'])
  status!: 'new' | 'learning' | 'known';
}

@ApiTags('Flashcards')
@StudyAccess()
@Controller('flashcards')
export class FlashcardsController {
  constructor(
    @Inject(GET_DECKS_USE_CASE) private readonly getDecks: GetDecksUseCase,
    @Inject(GET_DECK_CARDS_USE_CASE) private readonly getCards: GetDeckCardsUseCase,
    @Inject(SET_CARD_STATUS_USE_CASE) private readonly setStatus: SetCardStatusUseCase,
  ) {}

  @Get('decks')
  async decks(@CurrentUser() user: AccessTokenClaims) {
    const result = await this.getDecks.execute(user.sub);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /** The whole bank, or one subject (subjectId) or one collection (collectionId). */
  @Get('cards')
  async cards(@CurrentUser() user: AccessTokenClaims, @Query() query: DeckQueryDto) {
    if (query.subjectId && query.collectionId) {
      throw new DomainException(
        AppError.validation('Send subjectId or collectionId, not both.', [
          { path: 'collectionId', code: 'CONFLICTING_FILTERS', message: 'Choose one deck.' },
        ]),
      );
    }
    const deck: DeckRef = query.subjectId
      ? { kind: 'subject', id: query.subjectId }
      : query.collectionId
        ? { kind: 'collection', id: query.collectionId }
        : { kind: 'all' };
    const result = await this.getCards.execute(user.sub, deck);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Put(':questionId')
  async status(
    @CurrentUser() user: AccessTokenClaims,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: CardStatusDto,
  ) {
    const result = await this.setStatus.execute(user.sub, questionId, dto.status);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }
}
