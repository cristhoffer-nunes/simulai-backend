import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { ReqId } from 'pino-http';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';

interface RequestWithId extends IncomingMessage {
  id: ReqId;
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.isProduction ? 'info' : 'debug',
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
          customProps: (req: RequestWithId) => ({ correlationId: String(req.id) }),
          // Request bodies are never logged (they carry passwords and, later, imported question
          // content); headers that carry credentials are redacted.
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: true,
        },
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
