import { HttpException } from '@nestjs/common';
import { AppError, ERROR_KIND_HTTP_STATUS } from './app-error';

export class DomainException extends HttpException {
  public readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message, ERROR_KIND_HTTP_STATUS[appError.kind]);
    this.appError = appError;
  }
}
