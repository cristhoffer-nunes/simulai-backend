import { randomUUID } from 'node:crypto';
import { contentHashOf, QuestionContent } from './question-content';

export type QuestionStatus = 'active' | 'archived';

export interface QuestionClassification {
  subjectId: string;
  topicId: string | null;
}

export interface QuestionProps extends QuestionClassification {
  id: string;
  ownerUserId: string;
  content: QuestionContent;
  status: QuestionStatus;
  contentHash: string;
  sourceImportId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Aggregate root: a student's question with its options. */
export class Question {
  private constructor(private props: QuestionProps) {}

  static create(
    ownerUserId: string,
    classification: QuestionClassification,
    content: QuestionContent,
    sourceImportId: string | null = null,
  ): Question {
    const now = new Date();
    return new Question({
      id: randomUUID(),
      ownerUserId,
      ...classification,
      content,
      status: 'active',
      contentHash: contentHashOf(content),
      sourceImportId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: QuestionProps): Question {
    return new Question(props);
  }

  get id(): string {
    return this.props.id;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get subjectId(): string {
    return this.props.subjectId;
  }
  get topicId(): string | null {
    return this.props.topicId;
  }
  get content(): QuestionContent {
    return this.props.content;
  }
  get status(): QuestionStatus {
    return this.props.status;
  }
  get contentHash(): string {
    return this.props.contentHash;
  }
  get sourceImportId(): string | null {
    return this.props.sourceImportId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Simulations keep their own snapshots (RN-013): editing never changes past exams. */
  changeContent(content: QuestionContent): void {
    this.props.content = content;
    this.props.contentHash = contentHashOf(content);
    this.touch();
  }

  reclassify(classification: QuestionClassification): void {
    this.props.subjectId = classification.subjectId;
    this.props.topicId = classification.topicId;
    this.touch();
  }

  /** Archived questions stay in the bank but are not eligible for new simulations (RN-011). */
  archive(): void {
    if (this.props.status === 'archived') return;
    this.props.status = 'archived';
    this.touch();
  }

  restore(): void {
    if (this.props.status === 'active') return;
    this.props.status = 'active';
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
