import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import {
  ADD_QUESTIONS_TO_COLLECTION_USE_CASE,
  IAddQuestionsToCollectionUseCase,
} from '../../application/use-cases/add-questions-to-collection.use-case';
import {
  CREATE_COLLECTION_USE_CASE,
  ICreateCollectionUseCase,
} from '../../application/use-cases/create-collection.use-case';
import {
  DELETE_COLLECTION_USE_CASE,
  IDeleteCollectionUseCase,
} from '../../application/use-cases/delete-collection.use-case';
import {
  GET_COLLECTION_USE_CASE,
  IGetCollectionUseCase,
} from '../../application/use-cases/get-collection.use-case';
import {
  IListCollectionsUseCase,
  LIST_COLLECTIONS_USE_CASE,
} from '../../application/use-cases/list-collections.use-case';
import {
  IRemoveQuestionFromCollectionUseCase,
  REMOVE_QUESTION_FROM_COLLECTION_USE_CASE,
} from '../../application/use-cases/remove-question-from-collection.use-case';
import {
  IUpdateCollectionUseCase,
  UPDATE_COLLECTION_USE_CASE,
} from '../../application/use-cases/update-collection.use-case';
import { AddQuestionsDto, CreateCollectionDto, UpdateCollectionDto } from '../dto/collection.dto';
import { StudyAccess } from '../study-access';

@ApiTags('Coleções')
@StudyAccess()
@Controller('collections')
export class CollectionsController {
  constructor(
    @Inject(LIST_COLLECTIONS_USE_CASE) private readonly listCollections: IListCollectionsUseCase,
    @Inject(GET_COLLECTION_USE_CASE) private readonly getCollection: IGetCollectionUseCase,
    @Inject(CREATE_COLLECTION_USE_CASE) private readonly createCollection: ICreateCollectionUseCase,
    @Inject(UPDATE_COLLECTION_USE_CASE) private readonly updateCollection: IUpdateCollectionUseCase,
    @Inject(DELETE_COLLECTION_USE_CASE) private readonly deleteCollection: IDeleteCollectionUseCase,
    @Inject(ADD_QUESTIONS_TO_COLLECTION_USE_CASE)
    private readonly addQuestions: IAddQuestionsToCollectionUseCase,
    @Inject(REMOVE_QUESTION_FROM_COLLECTION_USE_CASE)
    private readonly removeQuestion: IRemoveQuestionFromCollectionUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AccessTokenClaims) {
    const result = await this.listCollections.execute(user.sub);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AccessTokenClaims, @Body() dto: CreateCollectionDto) {
    const result = await this.createCollection.execute({ userId: user.sub, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.getCollection.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    const result = await this.updateCollection.execute({
      userId: user.sub,
      collectionId: id,
      ...dto,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /** Deletes the collection only; its questions stay in the bank. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const result = await this.deleteCollection.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
  }

  /** Bulk add (used by the "Adicionar questões" picker). */
  @Post(':id/questions')
  @HttpCode(HttpStatus.OK)
  async addMany(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddQuestionsDto,
  ) {
    const result = await this.addQuestions.execute({
      userId: user.sub,
      collectionId: id,
      questionIds: dto.questionIds,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Put(':id/questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async addOne(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
  ): Promise<void> {
    const result = await this.addQuestions.execute({
      userId: user.sub,
      collectionId: id,
      questionIds: [questionId],
    });
    if (result.isFailure) throw new DomainException(result.error);
  }

  @Delete(':id/questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOne(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
  ): Promise<void> {
    const result = await this.removeQuestion.execute(user.sub, id, questionId);
    if (result.isFailure) throw new DomainException(result.error);
  }
}
