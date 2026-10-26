// The real client needs the native query engine; the service logic does not.
jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
  },
}));

import { PrismaService } from '@/shared/database/prisma.service';

describe('PrismaService', () => {
  it('connects, logs database/schema and disconnects', async () => {
    const service = new PrismaService({
      databaseUrl: 'postgresql://u:p@h:5432/dev?schema=simulai_service',
    } as never);
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();
    const log = jest
      .spyOn((service as unknown as { logger: { log: jest.Mock } }).logger, 'log')
      .mockImplementation();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'Connected to Postgres (database "dev", schema "simulai_service").',
    );
  });

  it('reports the public schema when none is given', async () => {
    const service = new PrismaService({ databaseUrl: 'postgresql://u:p@h:5432/tst' } as never);
    jest.spyOn(service, '$connect').mockResolvedValue();
    const log = jest
      .spyOn((service as unknown as { logger: { log: jest.Mock } }).logger, 'log')
      .mockImplementation();
    await service.onModuleInit();
    expect(log).toHaveBeenCalledWith('Connected to Postgres (database "tst", schema "public").');
  });
});
