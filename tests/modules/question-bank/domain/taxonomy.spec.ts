import { CatalogName } from '@/modules/question-bank/domain/shared/catalog-name.vo';
import { Subject } from '@/modules/question-bank/domain/taxonomy/subject.entity';

describe('CatalogName', () => {
  it('normalizes spaces and rejects empty or long names', () => {
    expect(CatalogName.create('  Clínica   médica ').value.toString()).toBe('Clínica médica');
    expect(CatalogName.create('   ').isFailure).toBe(true);
    expect(CatalogName.create('x'.repeat(121)).isFailure).toBe(true);
    expect(CatalogName.create(undefined as unknown as string).isFailure).toBe(true);
  });

  it('matches names ignoring case and accents', () => {
    expect(CatalogName.create('CARDIOLÓGIA').value.matchKey()).toBe(
      CatalogName.keyOf('cardiologia'),
    );
  });
});

describe('Subject', () => {
  const catalog = Subject.reconstitute({
    id: 's1',
    knowledgeAreaId: 'a1',
    ownerUserId: null,
    name: 'Anatomia',
    topics: [{ id: 't1', subjectId: 's1', ownerUserId: null, name: 'Tórax' }],
  });

  it('is visible to everyone when it belongs to the catalog', () => {
    expect(catalog.isVisibleTo('anyone')).toBe(true);
    const own = Subject.create('a1', 'u1', CatalogName.create('Minha').value);
    expect(own.isVisibleTo('u1')).toBe(true);
    expect(own.isVisibleTo('u2')).toBe(false);
    expect(own.knowledgeAreaId).toBe('a1');
  });

  it('finds topics by id or by equivalent name and adds private ones', () => {
    expect(catalog.findTopic('t1')?.name).toBe('Tórax');
    expect(catalog.findTopicByName(CatalogName.create('torax').value)?.id).toBe('t1');
    const topic = catalog.newTopic('u1', CatalogName.create('Coronárias').value);
    expect(topic).toEqual(expect.objectContaining({ subjectId: 's1', ownerUserId: 'u1' }));
    expect(catalog.topics).toHaveLength(2);
  });
});
