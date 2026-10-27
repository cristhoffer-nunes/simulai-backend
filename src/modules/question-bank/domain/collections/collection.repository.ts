import { Collection } from './collection.entity';

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: Date;
}

export interface ICollectionRepository {
  listByOwner(ownerUserId: string): Promise<CollectionSummary[]>;
  summary(ownerUserId: string, collectionId: string): Promise<CollectionSummary | null>;
  /** The collection if it belongs to this student, otherwise null. */
  findOwned(ownerUserId: string, collectionId: string): Promise<Collection | null>;
  /** Which of these ids are collections of this student. */
  ownedIds(ownerUserId: string, collectionIds: string[]): Promise<string[]>;
  create(collection: Collection): Promise<void>;
  save(collection: Collection): Promise<void>;
  /** Removes the collection and its memberships; questions stay. */
  delete(collectionId: string): Promise<void>;
  /** Adds memberships, ignoring the ones that already exist. Returns how many were new. */
  addQuestions(collectionId: string, questionIds: string[]): Promise<number>;
  removeQuestion(collectionId: string, questionId: string): Promise<void>;
}

export const COLLECTION_REPOSITORY = Symbol('COLLECTION_REPOSITORY');
