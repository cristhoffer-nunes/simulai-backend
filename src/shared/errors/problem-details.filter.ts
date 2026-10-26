import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainException } from './domain.exception';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: unknown;
}

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
  errors?: unknown;
}

// RFC 9457 problem+json — same error envelope as lawsuits-management-backend, so the frontends of
// both systems share one error-parsing convention (title = machine-readable kind).
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const correlationId = request.id;

    const problem = this.toProblemDetails(exception, request.url, correlationId);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url} [${correlationId}]`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }

  private toProblemDetails(
    exception: unknown,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    if (exception instanceof DomainException) {
      return {
        type: `/problems/${exception.appError.kind.toLowerCase().replace(/_/g, '-')}`,
        title: exception.appError.kind,
        status: exception.getStatus(),
        detail: exception.appError.message,
        instance: `${instance}#${correlationId}`,
        errors: exception.appError.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: unknown = exception.getResponse();
      const bodyObject = this.isHttpExceptionBody(body) ? body : undefined;
      const detail = typeof body === 'string' ? body : (bodyObject?.message ?? exception.message);

      return {
        type: '/problems/http-error',
        title: HttpStatus[status] ?? 'Error',
        status,
        detail: Array.isArray(detail) ? detail.join(' ') : String(detail),
        instance: `${instance}#${correlationId}`,
        errors: bodyObject?.errors,
      };
    }

    return {
      type: '/problems/internal-error',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
      instance: `${instance}#${correlationId}`,
    };
  }

  private isHttpExceptionBody(body: unknown): body is HttpExceptionBody {
    return typeof body === 'object' && body !== null;
  }
}
