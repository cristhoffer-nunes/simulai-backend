import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '../../identity/domain/services/access-policy';
import { RequirePermissions } from '../../identity/presentation/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../identity/presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../identity/presentation/guards/permissions.guard';

/** Study area: signed in + study.access (students and administrators; each sees only their own data). */
export const StudyAccess = () =>
  applyDecorators(
    ApiBearerAuth(),
    UseGuards(JwtAuthGuard, PermissionsGuard),
    RequirePermissions(Permissions.STUDY_ACCESS),
  );
