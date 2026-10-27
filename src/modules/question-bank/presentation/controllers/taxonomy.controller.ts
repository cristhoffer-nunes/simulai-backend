import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import {
  CREATE_SUBJECT_USE_CASE,
  ICreateSubjectUseCase,
} from '../../application/use-cases/create-subject.use-case';
import {
  CREATE_TOPIC_USE_CASE,
  ICreateTopicUseCase,
} from '../../application/use-cases/create-topic.use-case';
import {
  GET_TAXONOMY_USE_CASE,
  IGetTaxonomyUseCase,
} from '../../application/use-cases/get-taxonomy.use-case';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { CreateTopicDto } from '../dto/create-topic.dto';
import { StudyAccess } from '../study-access';

@ApiTags('Taxonomia')
@StudyAccess()
@Controller()
export class TaxonomyController {
  constructor(
    @Inject(GET_TAXONOMY_USE_CASE) private readonly getTaxonomy: IGetTaxonomyUseCase,
    @Inject(CREATE_SUBJECT_USE_CASE) private readonly createSubject: ICreateSubjectUseCase,
    @Inject(CREATE_TOPIC_USE_CASE) private readonly createTopic: ICreateTopicUseCase,
  ) {}

  @Get('taxonomy')
  async tree(@CurrentUser() user: AccessTokenClaims) {
    const result = await this.getTaxonomy.execute(user.sub);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /** 201 when created, 200 when an entry with the same name already existed. */
  @Post('subjects')
  async addSubject(
    @CurrentUser() user: AccessTokenClaims,
    @Body() dto: CreateSubjectDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.createSubject.execute({ userId: user.sub, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    reply.status(result.value.created ? 201 : 200);
    return result.value;
  }

  @Post('subjects/:subjectId/topics')
  async addTopic(
    @CurrentUser() user: AccessTokenClaims,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Body() dto: CreateTopicDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.createTopic.execute({ userId: user.sub, subjectId, name: dto.name });
    if (result.isFailure) throw new DomainException(result.error);
    reply.status(result.value.created ? 201 : 200);
    return result.value;
  }
}
