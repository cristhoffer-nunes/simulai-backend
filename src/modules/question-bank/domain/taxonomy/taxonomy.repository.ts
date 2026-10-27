import { CatalogName } from '../shared/catalog-name.vo';
import { Subject, TopicProps } from './subject.entity';

export interface TaxonomyTopicView {
  id: string;
  name: string;
  custom: boolean;
  questionCount: number;
}

export interface TaxonomySubjectView {
  id: string;
  name: string;
  custom: boolean;
  questionCount: number;
  topics: TaxonomyTopicView[];
}

export interface TaxonomyAreaView {
  id: string;
  name: string;
  subjects: TaxonomySubjectView[];
}

export interface ITaxonomyRepository {
  /** Catalog + the student's own subjects/topics, with their active-question counts. */
  treeFor(userId: string): Promise<TaxonomyAreaView[]>;
  areaExists(areaId: string): Promise<boolean>;
  /** The subject (with topics visible to the user), or null if missing or someone else's. */
  findVisibleSubject(userId: string, subjectId: string): Promise<Subject | null>;
  findVisibleSubjectByName(
    userId: string,
    areaId: string,
    name: CatalogName,
  ): Promise<Subject | null>;
  createSubject(subject: Subject): Promise<void>;
  addTopic(topic: TopicProps): Promise<void>;
}

export const TAXONOMY_REPOSITORY = Symbol('TAXONOMY_REPOSITORY');
