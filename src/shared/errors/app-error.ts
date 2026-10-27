import { HttpStatus } from '@nestjs/common';

export type ErrorKind =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'USER_INACTIVE'
  | 'EMAIL_ALREADY_IN_USE'
  | 'INVALID_REFRESH_TOKEN'
  | 'ROLE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_RESET_TOKEN'
  | 'WEAK_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'CANNOT_MODIFY_SELF'
  | 'NOT_FOUND'
  | 'CONFLICT';

export class AppError {
  constructor(
    public readonly kind: ErrorKind,
    public readonly message: string,
    public readonly details?: unknown,
  ) {}

  static validation(message: string, details?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }

  static invalidCredentials(): AppError {
    return new AppError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  static userInactive(): AppError {
    return new AppError('USER_INACTIVE', 'This user account is inactive.');
  }

  static emailAlreadyInUse(email: string): AppError {
    return new AppError('EMAIL_ALREADY_IN_USE', `Email "${email}" is already registered.`);
  }

  static invalidRefreshToken(): AppError {
    return new AppError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid, expired or revoked.');
  }

  static roleNotFound(name: string): AppError {
    return new AppError('ROLE_NOT_FOUND', `Role "${name}" does not exist.`);
  }

  static rateLimited(retryAfterSeconds: number): AppError {
    return new AppError('RATE_LIMITED', 'Too many attempts. Please try again later.', {
      retryAfterSeconds,
    });
  }

  static invalidResetToken(): AppError {
    return new AppError('INVALID_RESET_TOKEN', 'This link is invalid, expired or already used.');
  }

  static weakPassword(): AppError {
    return new AppError('WEAK_PASSWORD', 'Password does not meet the minimum requirements.');
  }

  // 404 instead of 403 on purpose: never reveal whether an id exists (02_BUSINESS_RULES).
  static userNotFound(userId: string): AppError {
    return new AppError('USER_NOT_FOUND', `User "${userId}" does not exist.`);
  }

  static cannotModifySelf(): AppError {
    return new AppError(
      'CANNOT_MODIFY_SELF',
      'Administrators cannot deactivate or demote their own account.',
    );
  }
}

export class ResourceErrors {
  // 404 for missing AND for other people's resources: never reveal that an id exists (RN-001).
  static notFound(resource: string): AppError {
    return new AppError('NOT_FOUND', `${resource} not found.`);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError('CONFLICT', message, details);
  }
}

export const ERROR_KIND_HTTP_STATUS: Record<ErrorKind, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  USER_INACTIVE: HttpStatus.FORBIDDEN,
  EMAIL_ALREADY_IN_USE: HttpStatus.CONFLICT,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  ROLE_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INVALID_RESET_TOKEN: HttpStatus.UNAUTHORIZED,
  WEAK_PASSWORD: HttpStatus.BAD_REQUEST,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  CANNOT_MODIFY_SELF: HttpStatus.CONFLICT,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
};
