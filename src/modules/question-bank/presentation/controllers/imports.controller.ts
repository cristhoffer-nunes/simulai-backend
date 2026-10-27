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
  Post,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../../identity/application/ports/token.port';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import {
  COMMIT_IMPORT_USE_CASE,
  ICommitImportUseCase,
} from '../../application/use-cases/commit-import.use-case';
import {
  GET_IMPORT_USE_CASE,
  IGetImportUseCase,
} from '../../application/use-cases/get-import.use-case';
import {
  DISCARD_IMPORT_USE_CASE,
  IDiscardImportUseCase,
} from '../../application/use-cases/discard-import.use-case';
import {
  IValidateImportUseCase,
  VALIDATE_IMPORT_USE_CASE,
} from '../../application/use-cases/validate-import.use-case';
import { CommitImportDto } from '../dto/commit-import.dto';
import { StudyAccess } from '../study-access';

@ApiTags('Importação')
@StudyAccess()
@Controller('imports')
export class ImportsController {
  constructor(
    @Inject(VALIDATE_IMPORT_USE_CASE) private readonly validateImport: IValidateImportUseCase,
    @Inject(DISCARD_IMPORT_USE_CASE) private readonly discardImport: IDiscardImportUseCase,
    @Inject(COMMIT_IMPORT_USE_CASE) private readonly commitImport: ICommitImportUseCase,
    @Inject(GET_IMPORT_USE_CASE) private readonly getImport: IGetImportUseCase,
  ) {}

  /** Confirms the selected items of a preview. Repeating the same idempotencyKey is safe. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async commit(@CurrentUser() user: AccessTokenClaims, @Body() dto: CommitImportDto) {
    const result = await this.commitImport.execute({ userId: user.sub, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.getImport.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  /**
   * Body: the AI's JSON as-is ({ schemaVersion: "1.0", questions: [...] }). It is not bound to a
   * DTO on purpose: every problem is reported per item and field instead of a single 400.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: { type: 'object' } })
  async validate(@CurrentUser() user: AccessTokenClaims, @Body() body: unknown) {
    const result = await this.validateImport.execute(user.sub, body);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(
    @CurrentUser() user: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const result = await this.discardImport.execute(user.sub, id);
    if (result.isFailure) throw new DomainException(result.error);
  }
}
