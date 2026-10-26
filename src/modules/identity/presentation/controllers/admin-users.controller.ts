import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../application/ports/token.port';
import {
  CREATE_USER_USE_CASE,
  ICreateUserUseCase,
} from '../../application/use-cases/create-user.use-case';
import {
  ISSUE_ACCESS_LINK_USE_CASE,
  IIssueAccessLinkUseCase,
} from '../../application/use-cases/issue-access-link.use-case';
import {
  LIST_USERS_USE_CASE,
  IListUsersUseCase,
} from '../../application/use-cases/list-users.use-case';
import {
  UPDATE_USER_USE_CASE,
  IUpdateUserUseCase,
} from '../../application/use-cases/update-user.use-case';
import { Permissions } from '../../domain/services/access-policy';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { CreateUserDto } from '../dto/create-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';

// Admin area. Every route requires users.manage, which the student role never has.
@ApiTags('Admin · Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.USERS_MANAGE)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @Inject(LIST_USERS_USE_CASE) private readonly listUsers: IListUsersUseCase,
    @Inject(CREATE_USER_USE_CASE) private readonly createUser: ICreateUserUseCase,
    @Inject(UPDATE_USER_USE_CASE) private readonly updateUser: IUpdateUserUseCase,
    @Inject(ISSUE_ACCESS_LINK_USE_CASE) private readonly issueAccessLink: IIssueAccessLinkUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto) {
    const result = await this.listUsers.execute(query);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto) {
    const result = await this.createUser.execute(dto);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const result = await this.updateUser.execute({ actorUserId: actor.sub, userId: id, ...dto });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Post(':id/access-link')
  @HttpCode(HttpStatus.OK)
  async accessLink(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const result = await this.issueAccessLink.execute(id);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }
}
