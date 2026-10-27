import { randomUUID } from 'node:crypto';
import { NormalizedImportItem } from './import-item';

export type ImportStatus = 'validated' | 'committed' | 'discarded';

/** A valid item of the preview, by its position in the original JSON. */
export interface PreviewItem {
  index: number;
  item: NormalizedImportItem;
  /** Same content hash as a question already in the student's bank. */
  duplicateOfBank: boolean;
  /** Same content hash as an earlier item of this same JSON. */
  duplicateOfIndex: number | null;
}

export interface QuestionImportProps {
  id: string;
  ownerUserId: string;
  schemaVersion: string;
  status: ImportStatus;
  totalCount: number;
  rejectedCount: number;
  duplicateCount: number;
  importedCount: number;
  idempotencyKey: string | null;
  preview: PreviewItem[];
  expiresAt: Date | null;
  createdAt: Date;
  committedAt: Date | null;
}

export const PREVIEW_TTL_MS = 60 * 60 * 1000;

/** Aggregate root: one import, from validation (preview) to commit or discard (RN-007..010). */
export class QuestionImport {
  private constructor(private props: QuestionImportProps) {}

  static validated(
    ownerUserId: string,
    schemaVersion: string,
    totalCount: number,
    preview: PreviewItem[],
    now = new Date(),
  ): QuestionImport {
    return new QuestionImport({
      id: randomUUID(),
      ownerUserId,
      schemaVersion,
      status: 'validated',
      totalCount,
      rejectedCount: totalCount - preview.length,
      duplicateCount: preview.filter(
        (entry) => entry.duplicateOfBank || entry.duplicateOfIndex !== null,
      ).length,
      importedCount: 0,
      idempotencyKey: null,
      preview,
      expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS),
      createdAt: now,
      committedAt: null,
    });
  }

  static reconstitute(props: QuestionImportProps): QuestionImport {
    return new QuestionImport(props);
  }

  get id(): string {
    return this.props.id;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get schemaVersion(): string {
    return this.props.schemaVersion;
  }
  get status(): ImportStatus {
    return this.props.status;
  }
  get totalCount(): number {
    return this.props.totalCount;
  }
  get rejectedCount(): number {
    return this.props.rejectedCount;
  }
  get duplicateCount(): number {
    return this.props.duplicateCount;
  }
  get importedCount(): number {
    return this.props.importedCount;
  }
  get idempotencyKey(): string | null {
    return this.props.idempotencyKey;
  }
  get preview(): readonly PreviewItem[] {
    return this.props.preview;
  }
  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get committedAt(): Date | null {
    return this.props.committedAt;
  }

  /** Can still be committed: validated and within its deadline. */
  isOpen(now = new Date()): boolean {
    return (
      this.props.status === 'validated' &&
      this.props.expiresAt !== null &&
      this.props.expiresAt.getTime() > now.getTime()
    );
  }

  /** Records the outcome; the preview is dropped once the questions exist. */
  markCommitted(
    idempotencyKey: string,
    importedCount: number,
    skippedDuplicates: number,
    now = new Date(),
  ): void {
    this.props.status = 'committed';
    this.props.idempotencyKey = idempotencyKey;
    this.props.importedCount = importedCount;
    this.props.duplicateCount = skippedDuplicates;
    this.props.committedAt = now;
    this.props.preview = [];
    this.props.expiresAt = null;
  }

  discard(): void {
    this.props.status = 'discarded';
    this.props.preview = [];
    this.props.expiresAt = null;
  }
}
