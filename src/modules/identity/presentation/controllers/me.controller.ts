import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DomainException } from '../../../../shared/errors/domain.exception';
import { AccessTokenClaims } from '../../application/ports/token.port';
import {
  GET_MY_PROFILE_USE_CASE,
  IGetMyProfileUseCase,
} from '../../application/use-cases/get-my-profile.use-case';
import {
  UPDATE_MY_PROFILE_USE_CASE,
  IUpdateMyProfileUseCase,
} from '../../application/use-cases/update-my-profile.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UpdateMyProfileDto } from '../dto/update-my-profile.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    @Inject(GET_MY_PROFILE_USE_CASE) private readonly getMyProfile: IGetMyProfileUseCase,
    @Inject(UPDATE_MY_PROFILE_USE_CASE) private readonly updateMyProfile: IUpdateMyProfileUseCase,
  ) {}

  @Get()
  async me(@CurrentUser() user: AccessTokenClaims) {
    const result = await this.getMyProfile.execute(user.sub);
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }

  @Patch()
  async update(@CurrentUser() user: AccessTokenClaims, @Body() dto: UpdateMyProfileDto) {
    const result = await this.updateMyProfile.execute({
      userId: user.sub,
      displayName: dto.displayName,
    });
    if (result.isFailure) throw new DomainException(result.error);
    return result.value;
  }
}
