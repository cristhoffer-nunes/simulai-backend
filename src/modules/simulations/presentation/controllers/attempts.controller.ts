import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import { StudyAccess } from '../../../question-bank/presentation/study-access';
import {
  FINISH_ATTEMPT_USE_CASE,
  IFinishAttemptUseCase,
} from '../../application/use-cases/finish-attempt.use-case';
import {
  CREATE_REVIEW_SIMULATION_USE_CASE,
  ICreateReviewSimulationUseCase,
} from '../../application/use-cases/create-review-simulation.use-case';
import {
  GET_ATTEMPT_RESULT_USE_CASE,
  IGetAttemptResultUseCase,
} from '../../application/use-cases/get-attempt-result.use-case';
import {
  GET_ATTEMPT_USE_CASE,
  IGetAttemptUseCase,
} from '../../application/use-cases/get-attempt.use-case';
import {
  ISaveAnswerUseCase,
  SAVE_ANSWER_USE_CASE,
} from '../../application/use-cases/save-answer.use-case';
import {
  IStartAttemptUseCase,
  START_ATTEMPT_USE_CASE,
} from '../../application/use-cases/start-attempt.use-case';
import { SaveAnswerDto } from '../dto/answer.dto';

// Exam data is never cached (API contract: no-store on exams and results).
@ApiTags('Provas')
@StudyAccess()
@Controller()
export class AttemptsController {
  constructor(
    @Inject(START_ATTEMPT_USE_CASE) private readonly startAttempt: IStartAttemptUseCase,
    @Inject(GET_ATTEMPT_USE_CASE) private readonly getAttempt: IGetAttemptUseCase,
    @Inject(SAVE_ANSWER_USE_CASE) private readonly saveAnswer: ISaveAnswerUseCase,
    @Inject(FINISH_ATTEMPT_USE_CASE) private readonly finishAttempt: IFinishAttemptUseCase,
    @Inject(GET_ATTEMPT_RESULT_USE_CASE) private readonly getResult: IGetAttemptResultUseCase,
    @Inject(CREATE_REVIEW_SIMULATION_USE_CASE)
    private readonly createReview: ICreateReviewSimulationUseCase,
  ) {}

  @Post('simulations/:id/attempts')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async start(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    const result = await this.startAttempt.execute(user.sub, simulationId);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get('attempts/:id')
  @Header('Cache-Control', 'no-store')
  async detail(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
  ) {
    const result = await this.getAttempt.execute(user.sub, attemptId);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Put('attempts/:id/answers/:questionId')
  @Header('Cache-Control', 'no-store')
  async answer(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    const result = await this.saveAnswer.execute({
      userId: user.sub,
      attemptId,
      questionId,
      selectedOptionId: dto.selectedOptionId,
      flagged: dto.flagged,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post('attempts/:id/finish')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async finish(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
  ) {
    const result = await this.finishAttempt.execute(user.sub, attemptId);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /** Answer key and explanations: 409 ATTEMPT_IN_PROGRESS until the attempt is finished. */
  @Get('attempts/:id/result')
  @Header('Cache-Control', 'no-store')
  async result(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
  ) {
    const result = await this.getResult.execute(user.sub, attemptId);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /** New simulation with the wrong and blank questions of a finished attempt (201). */
  @Post('attempts/:id/review-simulation')
  @HttpCode(HttpStatus.CREATED)
  async review(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
  ) {
    const result = await this.createReview.execute(user.sub, attemptId);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }
}
