/** Where a card stands for one student. "new" = never sorted (no stored row). */
export type FlashcardStatus = 'new' | 'learning' | 'known';

/** A set of cards: the whole bank, one subject or one collection. */
export type DeckRef =
  { kind: 'all' } | { kind: 'subject'; id: string } | { kind: 'collection'; id: string };

export interface DeckSummary {
  kind: DeckRef['kind'];
  /** null for the whole bank. */
  id: string | null;
  name: string;
  total: number;
  known: number;
  learning: number;
}

/**
 * One card: a question of the student's own bank, answer key included (the student owns it; the
 * bank already shows the key when editing).
 */
export interface FlashcardView {
  questionId: string;
  statement: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  sourceReference: string | null;
  subjectName: string;
  topicName: string | null;
  difficulty: string;
  status: FlashcardStatus;
}

export interface IFlashcardStore {
  /** Every deck with active questions (collections even when empty), with progress counts. */
  decks(ownerUserId: string): Promise<DeckSummary[]>;
  /** The active questions of a deck, oldest first; null when the deck is not the student's. */
  cards(
    ownerUserId: string,
    deck: DeckRef,
  ): Promise<{ name: string; cards: FlashcardView[] } | null>;
  /** Stores (or clears, with "new") a card's status; false when the question is not the student's. */
  setStatus(ownerUserId: string, questionId: string, status: FlashcardStatus): Promise<boolean>;
}

export const FLASHCARD_STORE = Symbol('FLASHCARD_STORE');
