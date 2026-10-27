import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '../../identity/domain/services/access-policy';
import { RequirePermissions } from '../../identity/presentation/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../identity/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../identity/presentation/guards/permissions.guard';

/** Student area: signed in + study.access. Administrators do not have it. */
export const StudyAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    UseGuards(JwtAuthGuard, PermissionsGuard),
    RequirePermissions(Permissions.STUDY_ACCESS),
  );
