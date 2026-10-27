import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AppError, ERROR_KIND_HTTP_STATUS } from '@/shared/errors/app-error';
import { DomainException } from '@/shared/errors/domain.exception';
import { ProblemDetailsFilter } from '@/shared/errors/problem-details.filter';

describe('AppError and DomainException', () => {
  it('every factory maps to an HTTP status', () => {
    const errors = [
      AppError.validation('v', { f: 1 }),
      AppError.invalidCredentials(),
      AppError.userInactive(),
      AppError.emailAlreadyInUse('a@b.co'),
      AppError.invalidRefreshToken(),
      AppError.roleNotFound('x'),
      AppError.rateLimited(30),
      AppError.invalidResetToken(),
      AppError.weakPassword(),
      AppError.userNotFound('u'),
      AppError.cannotModifySelf(),
    ];
    for (const error of errors) {
      expect(new DomainException(error).getStatus()).toBe(ERROR_KIND_HTTP_STATUS[error.kind]);
    }
    expect(AppError.rateLimited(30).details).toEqual({ retryAfterSeconds: 30 });
  });
});

describe('ProblemDetailsFilter', () => {
  function run(exception: unknown) {
    const reply = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => reply,
        getRequest: () => ({ id: 'req-1', url: '/v1/x', method: 'GET' }),
      }),
    };
    new ProblemDetailsFilter().catch(exception, host as never);
    return { reply, body: reply.send.mock.calls[0][0] };
  }

  it('renders domain errors with the kind as title', () => {
    const { reply, body } = run(new DomainException(AppError.rateLimited(10)));
    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.header).toHaveBeenCalledWith('content-type', 'application/problem+json');
    expect(body).toEqual({
      type: '/problems/rate-limited',
      title: 'RATE_LIMITED',
      status: 429,
      detail: 'Too many attempts. Please try again later.',
      instance: '/v1/x#req-1',
      errors: { retryAfterSeconds: 10 },
    });
  });

  it('renders Nest HTTP exceptions, joining validation messages', () => {
    expect(run(new BadRequestException(['a must be set', 'b too'])).body).toEqual(
      expect.objectContaining({ title: 'BAD_REQUEST', status: 400, detail: 'a must be set b too' }),
    );
    expect(run(new NotFoundException()).body.detail).toBe('Not Found');
  });

  it('renders string-bodied exceptions', () => {
    const exception = new (class extends BadRequestException {
      getResponse() {
        return 'plain';
      }
    })();
    expect(run(exception).body.detail).toBe('plain');
  });

  it('hides unexpected errors behind a 500', () => {
    const { body } = run(new Error('db password leaked?'));
    expect(body).toEqual(
      expect.objectContaining({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An unexpected error occurred.',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('leaked');
    run('a string');
  });

  it('answers Fastify client errors (e.g. empty JSON body) with their 4xx status', () => {
    const empty = Object.assign(
      new Error("Body cannot be empty when content-type is set to 'application/json'"),
      {
        code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
        statusCode: 400,
      },
    );
    expect(run(empty).body).toEqual({
      type: '/problems/http-error',
      title: 'BAD_REQUEST',
      status: 400,
      detail: "Body cannot be empty when content-type is set to 'application/json'",
      instance: '/v1/x#req-1',
    });
    const tooLarge = { code: 'FST_ERR_CTP_BODY_TOO_LARGE', statusCode: 413 };
    expect(run(tooLarge).body).toEqual(
      expect.objectContaining({ status: 413, detail: 'Bad request.' }),
    );
    const odd = { code: 'FST_X', statusCode: 499 };
    expect(run(odd).body.title).toBe('Error');
    // Not Fastify, or not a client error: still a hidden 500.
    expect(run({ code: 'OTHER', statusCode: 400 }).body.status).toBe(500);
    expect(run({ code: 'FST_ERR_X', statusCode: 503 }).body.status).toBe(500);
    expect(run({ code: 'FST_ERR_X' }).body.status).toBe(500);
  });
});
