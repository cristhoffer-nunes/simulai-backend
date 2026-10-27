import {
  Collection,
  normalizeDescription,
} from '@/modules/question-bank/domain/collections/collection.entity';
import { CatalogName } from '@/modules/question-bank/domain/shared/catalog-name.vo';

describe('Collection', () => {
  it('is created, renamed and described', () => {
    const collection = Collection.create('u1', CatalogName.create('Revisão R1').value, null);
    expect(collection.ownerUserId).toBe('u1');
    expect(collection.createdAt).toBeInstanceOf(Date);
    collection.rename(CatalogName.create('Revisão final').value);
    collection.describe('Cardio');
    expect([collection.name, collection.description]).toEqual(['Revisão final', 'Cardio']);
  });

  it('normalizes descriptions', () => {
    expect(normalizeDescription('  ').value).toBeNull();
    expect(normalizeDescription(undefined).value).toBeNull();
    expect(normalizeDescription(' Netter ').value).toBe('Netter');
    expect(normalizeDescription('x'.repeat(501)).isFailure).toBe(true);
  });
});
