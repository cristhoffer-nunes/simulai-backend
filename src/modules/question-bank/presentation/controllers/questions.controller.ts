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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import {
  ARCHIVE_QUESTION_USE_CASE,
  IArchiveQuestionUseCase,
} from '../../application/use-cases/archive-question.use-case';
import {
  CREATE_QUESTION_USE_CASE,
  ICreateQuestionUseCase,
} from '../../application/use-cases/create-question.use-case';
import {
  GET_QUESTION_USE_CASE,
  IGetQuestionUseCase,
} from '../../application/use-cases/get-question.use-case';
import {
  IListQuestionsUseCase,
  LIST_QUESTIONS_USE_CASE,
} from '../../application/use-cases/list-questions.use-case';
import {
  IUpdateQuestionUseCase,
  UPDATE_QUESTION_USE_CASE,
} from '../../application/use-cases/update-question.use-case';
import { CreateQuestionDto, ListQuestionsQueryDto, UpdateQuestionDto } from '../dto/question.dto';
import { StudyAccess } from '../study-access';

@ApiTags('Questões')
@StudyAccess()
@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(LIST_QUESTIONS_USE_CASE) private readonly listQuestions: IListQuestionsUseCase,
    @Inject(GET_QUESTION_USE_CASE) private readonly getQuestion: IGetQuestionUseCase,
    @Inject(CREATE_QUESTION_USE_CASE) private readonly createQuestion: ICreateQuestionUseCase,
    @Inject(UPDATE_QUESTION_USE_CASE) private readonly updateQuestion: IUpdateQuestionUseCase,
    @Inject(ARCHIVE_QUESTION_USE_CASE) private readonly archiveQuestion: IArchiveQuestionUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AccessTokenClaims, @Query() query: ListQuestionsQueryDto) {
    const result = await this.listQuestions.execute({ userId: user.sub, ...query });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AccessTokenClaims, @Body() dto: CreateQuestionDto) {
    const result = await this.createQuestion.execute({ userId: user.sub, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.getQuestion.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    const result = await this.updateQuestion.execute({ userId: user.sub, questionId: id, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /** Logical removal: archives the question (API contract). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const result = await this.archiveQuestion.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
  }
}
